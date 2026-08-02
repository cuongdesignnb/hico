import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { migrationStatus } from './migrateDatabase.js';

const unsafePattern = 'LPA:|qrcode|qr code|pin|puk|iccid|secret|password|token|full address';

export const validateCustomerNotifications = async ({ pool } = {}) => {
  if (!pool) return { status: 'unavailable', reason: 'DATABASE_REQUIRED' };
  const migration = await migrationStatus({ pool });
  if (!migration.applied.includes('010_referral_notifications.sql')) return { status: 'not_ready', reason: 'MIGRATION_NOT_APPLIED', migration };
  const checks = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM customer_notifications').then((r) => ['notifications', Number(r.rows[0].count)]),
    pool.query('SELECT COUNT(*)::int AS count FROM customer_notifications n LEFT JOIN customers c ON c.id = n.customer_id WHERE c.id IS NULL').then((r) => ['orphanNotifications', Number(r.rows[0].count)]),
    pool.query('SELECT COUNT(*)::int AS count FROM (SELECT customer_id, dedupe_key FROM customer_notifications GROUP BY customer_id, dedupe_key HAVING COUNT(*) > 1) duplicates').then((r) => ['duplicateDedupeKeys', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM customer_notifications WHERE action_path IS NOT NULL AND (action_path NOT LIKE '/%' OR action_path LIKE '//%')").then((r) => ['unsafeActionPaths', Number(r.rows[0].count)]),
    pool.query('SELECT COUNT(*)::int AS count FROM customer_notifications WHERE title ~* $1 OR message ~* $1', [unsafePattern]).then((r) => ['sensitiveMessages', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM customer_notifications WHERE status = 'UNREAD'").then((r) => ['unreadNotifications', Number(r.rows[0].count)]),
  ]);
  const report = Object.fromEntries(checks);
  const status = report.orphanNotifications === 0 && report.duplicateDedupeKeys === 0 && report.unsafeActionPaths === 0 && report.sensitiveMessages === 0 ? 'pass' : 'fail';
  return { status, ...report };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = process.env.DATABASE_URL ? createPostgresPool() : null;
  try { process.stdout.write(`${JSON.stringify(await validateCustomerNotifications({ pool }), null, 2)}\n`); }
  finally { await pool?.end(); }
}
