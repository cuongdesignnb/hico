import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { migrationStatus } from './migrateDatabase.js';

const unavailable = (reason = 'DATABASE_REQUIRED') => ({ status: 'unavailable', reason, migration: null });

export const validateReferralData = async ({ pool } = {}) => {
  if (!pool) return unavailable();
  const migration = await migrationStatus({ pool });
  if (!migration.applied.includes('010_referral_notifications.sql')) return { status: 'not_ready', reason: 'MIGRATION_NOT_APPLIED', migration };
  const checks = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM referral_codes').then((r) => ['referralCodes', Number(r.rows[0].count)]),
    pool.query('SELECT COUNT(*)::int AS count FROM referral_relationships').then((r) => ['relationships', Number(r.rows[0].count)]),
    pool.query('SELECT COUNT(*)::int AS count FROM referral_rewards').then((r) => ['rewards', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM referral_relationships rr LEFT JOIN customers c1 ON c1.id = rr.referrer_customer_id LEFT JOIN customers c2 ON c2.id = rr.referee_customer_id WHERE c1.id IS NULL OR c2.id IS NULL").then((r) => ['orphanRelationships', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM referral_rewards rw LEFT JOIN referral_relationships rr ON rr.id = rw.relationship_id LEFT JOIN loyalty_ledger ll ON ll.id = rw.ledger_entry_id WHERE rr.id IS NULL OR ll.id IS NULL").then((r) => ['orphanRewards', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM (SELECT code FROM referral_codes WHERE status = 'ACTIVE' GROUP BY code HAVING COUNT(*) > 1) duplicates").then((r) => ['duplicateActiveCodes', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM referral_relationships WHERE status = 'MANUAL_REVIEW'").then((r) => ['manualReview', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM orders WHERE ownership_status = 'LEGACY_UNRESOLVED'").then((r) => ['legacyUnresolved', Number(r.rows[0].count)]),
  ]);
  const report = Object.fromEntries(checks);
  const status = report.orphanRelationships === 0 && report.orphanRewards === 0 && report.duplicateActiveCodes === 0 ? 'pass' : 'fail';
  return { status, ...report };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = process.env.DATABASE_URL ? createPostgresPool() : null;
  try { process.stdout.write(`${JSON.stringify(await validateReferralData({ pool }), null, 2)}\n`); }
  finally { await pool?.end(); }
}
