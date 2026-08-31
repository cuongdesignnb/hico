import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { migrationStatus } from './migrateDatabase.js';

const migrationHead = '012_customer_platform_cutover.sql';
const isMain = process.argv[1] === fileURLToPath(import.meta.url);

const count = async (pool, table, where = '') => {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}${where ? ` WHERE ${where}` : ''}`);
  return result.rows[0]?.count ?? 0;
};

export const validateCustomerPlatformMigration = async ({ pool, env = process.env } = {}) => {
  if (!pool) return { status: 'unavailable', code: 'DATABASE_REQUIRED', migrationHead, blockers: ['DATABASE_REQUIRED'] };
  const migration = await migrationStatus({ pool });
  const blockers = [];
  if (migration.status !== 'current' || !migration.applied.includes(migrationHead)) blockers.push('CUSTOMER_PLATFORM_MIGRATION_NOT_CURRENT');
  let tables = {};
  let counts = {};
  try {
    const tableResult = await pool.query(`
      SELECT name, to_regclass(name) IS NOT NULL AS present
      FROM unnest(ARRAY[
        'customers', 'customer_profiles', 'customer_addresses', 'customer_sessions',
        'orders', 'order_items', 'guest_order_claims', 'order_ownership_events',
        'loyalty_accounts', 'loyalty_ledger', 'referral_relationships',
        'customer_notifications', 'support_tickets', 'support_ticket_messages',
        'support_attachments', 'customer_data_quarantine'
      ]) AS item(name)
    `);
    tables = Object.fromEntries(tableResult.rows.map((row) => [row.name, row.present]));
    for (const [table, present] of Object.entries(tables)) if (!present) blockers.push(`TABLE_MISSING_${table.toUpperCase()}`);
    if (!blockers.length) {
      counts = {
        customers: await count(pool, 'customers'),
        profiles: await count(pool, 'customer_profiles'),
        addresses: await count(pool, 'customer_addresses'),
        activeSessions: await count(pool, 'customer_sessions', 'revoked_at IS NULL'),
        ownedOrders: await count(pool, 'orders', "ownership_status = 'OWNED'"),
        guestUnclaimedOrders: await count(pool, 'orders', "ownership_status = 'GUEST_UNCLAIMED'"),
        legacyUnresolvedOrders: await count(pool, 'orders', "ownership_status = 'LEGACY_UNRESOLVED'"),
        manualReviewOrders: await count(pool, 'orders', "ownership_status = 'MANUAL_REVIEW'"),
        loyaltyAccounts: await count(pool, 'loyalty_accounts'),
        loyaltyLedgerEntries: await count(pool, 'loyalty_ledger'),
        referrals: await count(pool, 'referral_relationships'),
        notifications: await count(pool, 'customer_notifications'),
        supportTickets: await count(pool, 'support_tickets'),
        supportMessages: await count(pool, 'support_ticket_messages'),
        supportAttachments: await count(pool, 'support_attachments'),
        quarantine: await count(pool, 'customer_data_quarantine'),
        quarantineOpen: await count(pool, 'customer_data_quarantine', "status IN ('QUARANTINED', 'MANUAL_REVIEW')"),
      };
      const invalidOwner = await count(pool, 'orders', "(ownership_status = 'OWNED' AND customer_id IS NULL) OR (ownership_status <> 'OWNED' AND customer_id IS NOT NULL)");
      const duplicateDefaults = await count(pool, '(SELECT customer_id FROM customer_addresses WHERE is_default GROUP BY customer_id HAVING COUNT(*) > 1) AS duplicate_defaults');
      const unsafeMetadata = await count(pool, 'customer_data_quarantine', "metadata_jsonb ?| ARRAY['email', 'phone', 'address', 'password', 'passwordHash', 'token', 'tokenHash', 'secret', 'qrcode', 'qrcodeContent', 'lpa', 'pin', 'puk', 'iccid', 'redemptionCode']");
      if (invalidOwner) blockers.push('ORDER_OWNERSHIP_CONSTRAINT_BROKEN');
      if (duplicateDefaults) blockers.push('ADDRESS_DEFAULT_CONSTRAINT_BROKEN');
      if (unsafeMetadata) blockers.push('QUARANTINE_SENSITIVE_METADATA');
    }
  } catch { blockers.push('CUSTOMER_PLATFORM_MIGRATION_QUERY_FAILED'); }
  return {
    status: blockers.length ? 'blocked' : 'passed',
    migrationHead,
    mode: String(env.CUSTOMER_ACCOUNT_MODE ?? 'demo').toLowerCase(),
    migrationsCurrent: migration.status === 'current',
    tables,
    counts,
    blockers,
    safeReport: true,
  };
};

if (isMain) {
  let pool;
  try {
    if (!process.env.DATABASE_URL) throw Object.assign(new Error('DATABASE_URL is required.'), { code: 'DATABASE_REQUIRED' });
    pool = createPostgresPool();
    const result = await validateCustomerPlatformMigration({ pool });
    console.log(JSON.stringify(result));
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ status: 'unavailable', code: error.code ?? 'CUSTOMER_PLATFORM_MIGRATION_VALIDATION_FAILED', blockers: [error.code ?? 'CUSTOMER_PLATFORM_MIGRATION_VALIDATION_FAILED'] }));
    process.exitCode = 1;
  } finally { await pool?.end(); }
}
