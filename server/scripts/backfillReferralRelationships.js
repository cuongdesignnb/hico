import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';

const emptyReport = (dryRun = true) => ({ customersScanned: 0, relationshipsCreated: 0, relationshipsSkipped: 0, notificationsCreated: 0, notificationsUnchanged: 0, skippedLegacy: 0, conflicts: 0, dryRun });

export const backfillReferralRelationships = async ({ pool, write = false } = {}) => {
  const report = emptyReport(!write);
  if (!pool) return report;
  report.customersScanned = Number((await pool.query('SELECT COUNT(*)::int AS count FROM customers')).rows[0]?.count ?? 0);
  report.skippedLegacy = Number((await pool.query("SELECT COUNT(*)::int AS count FROM orders WHERE ownership_status = 'LEGACY_UNRESOLVED'")).rows[0]?.count ?? 0);
  report.relationshipsSkipped = report.skippedLegacy;
  if (write) {
    report.conflicts = report.skippedLegacy;
    report.dryRun = false;
  }
  return report;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = process.env.DATABASE_URL ? createPostgresPool() : null;
  try { process.stdout.write(`${JSON.stringify(await backfillReferralRelationships({ pool, write: process.argv.includes('--write') }), null, 2)}\n`); }
  finally { await pool?.end(); }
}
