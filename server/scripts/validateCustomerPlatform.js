import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { inventoryCustomerPlatform } from './inventoryCustomerPlatform.js';
import { validateCustomerPlatformMigration } from './validateCustomerPlatformMigration.js';
import { verifyCustomerRealMode } from './verifyCustomerRealMode.js';

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

export const validateCustomerPlatform = async ({ env = process.env, pool } = {}) => {
  const inventory = await inventoryCustomerPlatform();
  const realMode = await verifyCustomerRealMode({ env, pool });
  const migration = await validateCustomerPlatformMigration({ env, pool });
  const blockers = [
    ...realMode.blockers,
    ...migration.blockers,
    ...(inventory.productionMockImports > 0 ? ['PRODUCTION_MOCK_IMPORTS_PRESENT'] : []),
    ...(inventory.productionSurface?.accountApiUserReferenceCount > 0 ? ['NEW_UI_LEGACY_USER_API_REFERENCE'] : []),
    ...(inventory.browserStorage?.authenticationKeys?.length > 0 ? ['LOCALSTORAGE_AUTH_SOURCE_PRESENT'] : []),
    ...(inventory.productionSurface?.hardCodedSensitiveDataCount > 0 ? ['PRODUCTION_HARDCODED_PRIVATE_DATA'] : []),
  ];
  return {
    status: blockers.length ? 'blocked' : 'passed',
    mode: realMode.customerMode,
    migrationHead: realMode.migrationHead,
    inventory: {
      customerCount: inventory.customerCount ?? inventory.datasets?.customerProfiles?.count ?? 0,
      demoProfileCount: inventory.demoProfileCount ?? inventory.datasets?.customerProfiles?.count ?? 0,
      legacyUnresolvedOrderCount: inventory.legacyUnresolvedOrderCount ?? inventory.ownership?.LEGACY_UNRESOLVED ?? 0,
      guestUnclaimedOrderCount: inventory.guestUnclaimedOrderCount ?? inventory.ownership?.GUEST_UNCLAIMED ?? 0,
      manualReviewOrderCount: inventory.manualReviewOrderCount ?? inventory.ownership?.MANUAL_REVIEW ?? 0,
      quarantineCount: migration.counts?.quarantine ?? 0,
    },
    realMode,
    migration,
    blockers: [...new Set(blockers)],
    safeReport: true,
  };
};

if (isMain) {
  let pool;
  try {
    if (!process.env.DATABASE_URL) throw Object.assign(new Error('DATABASE_URL is required.'), { code: 'DATABASE_REQUIRED' });
    pool = createPostgresPool();
    const result = await validateCustomerPlatform({ pool });
    console.log(JSON.stringify(result));
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ status: 'blocked', code: error.code ?? 'CUSTOMER_PLATFORM_VALIDATION_FAILED', blockers: [error.code ?? 'CUSTOMER_PLATFORM_VALIDATION_FAILED'] }));
    process.exitCode = 1;
  } finally { await pool?.end(); }
}
