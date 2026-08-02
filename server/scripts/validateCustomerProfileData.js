import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { migrationStatus } from './migrateDatabase.js';

export const validateCustomerProfileData = async ({ pool } = {}) => {
  if (!pool) return { status: 'unavailable', reason: 'DATABASE_REQUIRED' };
  const migration = await migrationStatus({ pool });
  if (!migration.applied.includes('011_customer_profile_security_support.sql')) return { status: 'not_ready', reason: 'MIGRATION_NOT_APPLIED', migration };
  const checks = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM customer_profiles p LEFT JOIN customers c ON c.id = p.customer_id WHERE c.id IS NULL').then((r) => ['orphanProfiles', Number(r.rows[0].count)]),
    pool.query('SELECT COUNT(*)::int AS count FROM customer_addresses a LEFT JOIN customers c ON c.id = a.customer_id WHERE c.id IS NULL').then((r) => ['orphanAddresses', Number(r.rows[0].count)]),
    pool.query('SELECT COUNT(*)::int AS count FROM (SELECT customer_id FROM customer_addresses WHERE is_default = TRUE GROUP BY customer_id HAVING COUNT(*) > 1) duplicates').then((r) => ['duplicateDefaults', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM customer_contact_changes WHERE status = 'PENDING' AND expires_at <= NOW()").then((r) => ['expiredPendingContactChanges', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM customer_security_events WHERE metadata::text ~* '(password|token|secret|cookie)' ").then((r) => ['sensitiveSecurityMetadata', Number(r.rows[0].count)]),
  ]);
  const report = Object.fromEntries(checks);
  const status = Object.values(report).every((value) => value === 0) ? 'pass' : 'fail';
  return { status, ...report, writesToSource: false, rawValuesInReport: false };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = process.env.DATABASE_URL ? createPostgresPool() : null;
  try { process.stdout.write(`${JSON.stringify(await validateCustomerProfileData({ pool }), null, 2)}\n`); }
  finally { await pool?.end(); }
}
