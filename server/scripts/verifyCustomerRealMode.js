import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { migrationStatus } from './migrateDatabase.js';

const migrationHead = '012_customer_platform_cutover.sql';
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
const trueValue = (value) => String(value ?? 'false').toLowerCase() === 'true';

export const verifyCustomerRealMode = async ({ env = process.env, pool } = {}) => {
  const blockers = [];
  const currentMode = String(env.CUSTOMER_ACCOUNT_MODE ?? 'demo').toLowerCase();
  if (currentMode !== 'real') blockers.push('CUSTOMER_ACCOUNT_MODE_REAL_REQUIRED');
  if (trueValue(env.CUSTOMER_DEMO_FALLBACK_ENABLED)) blockers.push('CUSTOMER_DEMO_FALLBACK_ENABLED');
  if (trueValue(env.LEGACY_CUSTOMER_API_ENABLED)) blockers.push('LEGACY_CUSTOMER_API_ENABLED');
  if (trueValue(env.LOYALTY_ENABLED)) blockers.push('LOYALTY_MUST_REMAIN_DISABLED');
  if (trueValue(env.REFERRAL_ENABLED)) blockers.push('REFERRAL_MUST_REMAIN_DISABLED');
  if (!trueValue(env.CUSTOMER_PROFILE_ENABLED)) blockers.push('CUSTOMER_PROFILE_ENABLED_REQUIRED');
  if (!trueValue(env.CUSTOMER_SUPPORT_ENABLED)) blockers.push('CUSTOMER_SUPPORT_ENABLED_REQUIRED');
  if (!trueValue(env.CUSTOMER_ASSETS_ENABLED)) blockers.push('CUSTOMER_ASSETS_ENABLED_REQUIRED');
  if (!trueValue(env.CUSTOMER_NOTIFICATIONS_ENABLED)) blockers.push('CUSTOMER_NOTIFICATIONS_ENABLED_REQUIRED');
  const migration = pool ? await migrationStatus({ pool }) : { status: 'unavailable', applied: [] };
  if (migration.status !== 'current' || !migration.applied.includes(migrationHead)) blockers.push('CUSTOMER_PLATFORM_MIGRATION_NOT_CURRENT');
  return {
    status: blockers.length ? 'blocked' : 'passed',
    customerMode: currentMode,
    targetMode: 'real',
    migrationHead,
    migrationsCurrent: migration.status === 'current',
    mockFallbackEnabled: trueValue(env.CUSTOMER_DEMO_FALLBACK_ENABLED),
    legacyUserApiEnabled: trueValue(env.LEGACY_CUSTOMER_API_ENABLED),
    loyaltyEnabled: trueValue(env.LOYALTY_ENABLED),
    referralEnabled: trueValue(env.REFERRAL_ENABLED),
    blockers,
    safeReport: true,
  };
};

if (isMain) {
  let pool;
  try {
    if (!process.env.DATABASE_URL) throw Object.assign(new Error('DATABASE_URL is required.'), { code: 'DATABASE_REQUIRED' });
    pool = createPostgresPool();
    const result = await verifyCustomerRealMode({ pool });
    console.log(JSON.stringify(result));
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ status: 'blocked', code: error.code ?? 'CUSTOMER_REAL_MODE_VERIFICATION_FAILED', blockers: [error.code ?? 'CUSTOMER_REAL_MODE_VERIFICATION_FAILED'] }));
    process.exitCode = 1;
  } finally { await pool?.end(); }
}
