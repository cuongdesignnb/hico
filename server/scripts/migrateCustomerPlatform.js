import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createPostgresPool } from '../database/postgresPool.js';
import { migrationStatus } from './migrateDatabase.js';
import { inventoryCustomerPlatform } from './inventoryCustomerPlatform.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(scriptDirectory, '..');
const reportDirectory = path.join(serverDirectory, 'uploads', 'migration_reports');
const migrationHead = '012_customer_platform_cutover.sql';
const countTables = {
  customers: 'customers',
  profiles: 'customer_profiles',
  addresses: 'customer_addresses',
  sessions: 'customer_sessions',
  orders: 'orders',
  ownedOrders: 'orders',
  loyaltyAccounts: 'loyalty_accounts',
  loyaltyLedgerEntries: 'loyalty_ledger',
  referrals: 'referral_relationships',
  notifications: 'customer_notifications',
  supportTickets: 'support_tickets',
  supportMessages: 'support_ticket_messages',
  supportAttachments: 'support_attachments',
  quarantine: 'customer_data_quarantine',
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
const hasDatabase = (env) => Boolean(String(env.DATABASE_URL ?? '').trim());
const mode = (env) => String(env.CUSTOMER_ACCOUNT_MODE ?? 'demo').toLowerCase();

const count = async (pool, table, where = '') => {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}${where ? ` WHERE ${where}` : ''}`);
  return result.rows[0]?.count ?? 0;
};

const readRuntimeCounts = async (pool) => ({
  customers: await count(pool, countTables.customers),
  profiles: await count(pool, countTables.profiles),
  addresses: await count(pool, countTables.addresses),
  sessions: await count(pool, countTables.sessions, 'revoked_at IS NULL'),
  orders: await count(pool, countTables.orders),
  ownedOrders: await count(pool, countTables.orders, "ownership_status = 'OWNED'"),
  guestUnclaimedOrders: await count(pool, countTables.orders, "ownership_status = 'GUEST_UNCLAIMED'"),
  legacyUnresolvedOrders: await count(pool, countTables.orders, "ownership_status = 'LEGACY_UNRESOLVED'"),
  manualReviewOrders: await count(pool, countTables.orders, "ownership_status = 'MANUAL_REVIEW'"),
  loyaltyAccounts: await count(pool, countTables.loyaltyAccounts),
  loyaltyLedgerEntries: await count(pool, countTables.loyaltyLedgerEntries),
  referrals: await count(pool, countTables.referrals),
  notifications: await count(pool, countTables.notifications),
  supportTickets: await count(pool, countTables.supportTickets),
  supportMessages: await count(pool, countTables.supportMessages),
  supportAttachments: await count(pool, countTables.supportAttachments),
  quarantine: await count(pool, countTables.quarantine),
});

const quarantineRows = (inventory) => {
  const rows = [];
  const add = (sourceType, reasonCode, count, sourcePrefix) => {
    for (let index = 0; index < count; index += 1) rows.push({
      id: randomUUID(),
      sourceType,
      sourceReference: `${sourcePrefix}:${index}`,
      reasonCode,
      metadata: { source: 'legacy-json', sourceIndex: index },
    });
  };
  add('DEMO_PROFILE', 'DEMO_PROFILE', inventory.datasets?.customerProfiles?.count ?? 0, 'customers.json');
  add('MOCK_ESIM', 'MOCK_ESIM', inventory.datasets?.esims?.count ?? 0, 'esims.json');
  add('MOCK_MANUAL_QR', 'MOCK_MANUAL_QR', inventory.datasets?.manualQrs?.count ?? 0, 'manual_qrs.json');
  add('LEGACY_ORDER_UNRESOLVED', 'LEGACY_ORDER_UNRESOLVED', inventory.ownership?.LEGACY_UNRESOLVED ?? 0, 'orders.json:legacy-unresolved');
  return rows;
};

const writeReport = async (report, outputPath) => {
  const target = outputPath ?? path.join(reportDirectory, `customer_platform_${Date.now()}.json`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return target;
};

export const createMigrationReport = ({ inventory, runtimeCounts = {}, env = process.env, dryRun = true, migration = { status: 'unavailable' }, quarantineCount = 0, conflicts = [] } = {}) => {
  const sourceCounts = inventory?.ownership ?? {};
  const blockers = [];
  if (!hasDatabase(env)) blockers.push('DATABASE_REQUIRED');
  if (migration.status !== 'current' || !migration.applied?.includes(migrationHead)) blockers.push('CUSTOMER_PLATFORM_MIGRATION_NOT_CURRENT');
  if (mode(env) !== 'real') blockers.push('CUSTOMER_ACCOUNT_MODE_REAL_REQUIRED');
  if (inventory?.productionMockImports > 0) blockers.push('PRODUCTION_MOCK_IMPORTS_PRESENT');
  if (conflicts.length) blockers.push('MIGRATION_CONFLICTS_PRESENT');
  return {
    dryRun,
    customerModeBefore: mode(env),
    targetMode: 'real',
    migrationHead,
    customersScanned: Math.max(runtimeCounts.customers ?? 0, inventory?.datasets?.customerProfiles?.count ?? 0),
    customersMigrated: 0,
    profilesSkippedDemo: inventory?.datasets?.customerProfiles?.count ?? 0,
    orders: {
      owned: Math.max(runtimeCounts.ownedOrders ?? 0, sourceCounts.OWNED ?? 0),
      guestUnclaimed: Math.max(runtimeCounts.guestUnclaimedOrders ?? 0, sourceCounts.GUEST_UNCLAIMED ?? 0),
      legacyUnresolved: Math.max(runtimeCounts.legacyUnresolvedOrders ?? 0, sourceCounts.LEGACY_UNRESOLVED ?? 0),
      manualReview: Math.max(runtimeCounts.manualReviewOrders ?? 0, sourceCounts.MANUAL_REVIEW ?? 0),
    },
    assets: {
      esim: 0,
      physicalSim: 0,
      device: 0,
      topup: 0,
      skippedMock: (inventory?.datasets?.esims?.count ?? 0) + (inventory?.datasets?.manualQrs?.count ?? 0),
    },
    loyalty: {
      accounts: runtimeCounts.loyaltyAccounts ?? 0,
      ledgerEntries: runtimeCounts.loyaltyLedgerEntries ?? 0,
      enabled: String(env.LOYALTY_ENABLED ?? 'false').toLowerCase() === 'true',
    },
    referrals: {
      relationships: runtimeCounts.referrals ?? 0,
      enabled: String(env.REFERRAL_ENABLED ?? 'false').toLowerCase() === 'true',
    },
    notifications: runtimeCounts.notifications ?? 0,
    supportTickets: runtimeCounts.supportTickets ?? 0,
    runtimeCounts: {
      profiles: runtimeCounts.profiles ?? 0,
      addresses: runtimeCounts.addresses ?? 0,
      sessions: runtimeCounts.sessions ?? 0,
      supportMessages: runtimeCounts.supportMessages ?? 0,
      supportAttachments: runtimeCounts.supportAttachments ?? 0,
    },
    quarantined: quarantineCount,
    conflicts,
    ready: blockers.length === 0,
    blockers,
  };
};

export const migrateCustomerPlatform = async ({ env = process.env, execute = false, pool: providedPool, outputPath } = {}) => {
  const inventory = await inventoryCustomerPlatform({ now: () => new Date() });
  const quarantine = quarantineRows(inventory);
  let pool = providedPool;
  let ownsPool = false;
  let migration = { status: 'unavailable', applied: [] };
  let runtimeCounts = {};
  try {
    if (hasDatabase(env)) {
      pool ??= createPostgresPool({ env });
      ownsPool = !providedPool;
      migration = await migrationStatus({ pool });
      if (migration.status === 'current') runtimeCounts = await readRuntimeCounts(pool);
    }
    const report = createMigrationReport({ inventory, runtimeCounts, env, dryRun: !execute, migration, quarantineCount: quarantine.length });
    if (execute) {
      if (!hasDatabase(env)) throw Object.assign(new Error('DATABASE_URL is required for execute.'), { code: 'DATABASE_REQUIRED' });
      if (mode(env) !== 'real') throw Object.assign(new Error('CUSTOMER_ACCOUNT_MODE=real is required for execute.'), { code: 'CUSTOMER_ACCOUNT_MODE_REAL_REQUIRED' });
      if (String(env.CUSTOMER_MIGRATION_APPROVED).toLowerCase() !== 'true') throw Object.assign(new Error('CUSTOMER_MIGRATION_APPROVED=true is required for execute.'), { code: 'CUSTOMER_MIGRATION_APPROVAL_REQUIRED' });
      if (String(env.CUSTOMER_MIGRATION_BACKUP_VERIFIED).toLowerCase() !== 'true') throw Object.assign(new Error('CUSTOMER_MIGRATION_BACKUP_VERIFIED=true is required for execute.'), { code: 'CUSTOMER_MIGRATION_BACKUP_REQUIRED' });
      if (report.blockers.length) throw Object.assign(new Error('Customer migration preflight failed.'), { code: 'CUSTOMER_MIGRATION_NOT_READY', blockers: report.blockers });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const row of quarantine) await client.query(`
          INSERT INTO customer_data_quarantine (id, source_type, source_reference, reason_code, metadata_jsonb)
          VALUES ($1, $2, $3, $4, $5::jsonb)
          ON CONFLICT (source_type, source_reference) DO NOTHING
        `, [row.id, row.sourceType, row.sourceReference, row.reasonCode, JSON.stringify(row.metadata)]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      runtimeCounts = await readRuntimeCounts(pool);
      report.quarantined = runtimeCounts.quarantine;
      report.runtimeCounts = { ...report.runtimeCounts, ...runtimeCounts };
      report.dryRun = false;
      report.ready = true;
      report.blockers = [];
    }
    const reportPath = await writeReport(report, outputPath);
    return { ...report, reportPath };
  } finally {
    if (ownsPool) await pool.end();
  }
};

if (isMain) {
  const execute = process.argv.includes('--execute');
  try {
    const result = await migrateCustomerPlatform({ execute });
    console.log(JSON.stringify(result));
    if (!result.ready) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: 'blocked', code: error.code ?? 'CUSTOMER_MIGRATION_FAILED', blockers: error.blockers ?? [error.code ?? 'CUSTOMER_MIGRATION_FAILED'] }));
    process.exitCode = 1;
  }
}
