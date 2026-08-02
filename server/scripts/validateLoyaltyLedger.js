import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { migrationStatus } from './migrateDatabase.js';

export const validateLoyaltyLedger = async ({ pool } = {}) => {
  if (!pool) return { status: 'unavailable', reason: 'DATABASE_REQUIRED' };
  const migrations = await migrationStatus({ pool });
  if (!migrations.applied.includes('009_loyalty_ledger.sql')) return { status: 'not_ready', reason: 'MIGRATION_NOT_APPLIED', migration: migrations };
  const checks = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM loyalty_accounts").then((r) => ['accounts', r.rows[0].count]),
    pool.query("SELECT COUNT(*)::int AS count FROM loyalty_ledger").then((r) => ['ledgerEntries', r.rows[0].count]),
    pool.query("SELECT COUNT(*)::int AS count FROM loyalty_ledger WHERE points = 0 OR (type = 'EARN' AND points <= 0) OR (type IN ('REDEEM','RESERVE','EXPIRE','REVERSE') AND points >= 0)").then((r) => ['invalidSigns', r.rows[0].count]),
    pool.query("SELECT COUNT(*)::int AS count FROM (SELECT idempotency_key FROM loyalty_ledger GROUP BY idempotency_key HAVING COUNT(*) > 1) duplicate_keys").then((r) => ['duplicateIdempotencyKeys', r.rows[0].count]),
    pool.query("SELECT COUNT(*)::int AS count FROM loyalty_ledger l LEFT JOIN customers c ON c.id = l.customer_id WHERE c.id IS NULL").then((r) => ['orphanEntries', r.rows[0].count]),
  ]);
  const report = Object.fromEntries(checks);
  return { status: Object.values(report).every((value) => value === 0 || typeof value !== 'number' || value >= 0) && report.invalidSigns === 0 && report.duplicateIdempotencyKeys === 0 && report.orphanEntries === 0 ? 'pass' : 'fail', ...report };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = process.env.DATABASE_URL ? createPostgresPool() : null;
  try { process.stdout.write(`${JSON.stringify(await validateLoyaltyLedger({ pool }), null, 2)}\n`); }
  finally { await pool?.end(); }
}
