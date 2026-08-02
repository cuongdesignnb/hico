import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { migrationStatus } from './migrateDatabase.js';

export const validateSupportData = async ({ pool } = {}) => {
  if (!pool) return { status: 'unavailable', reason: 'DATABASE_REQUIRED' };
  const migration = await migrationStatus({ pool });
  if (!migration.applied.includes('011_customer_profile_security_support.sql')) return { status: 'not_ready', reason: 'MIGRATION_NOT_APPLIED', migration };
  const checks = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM support_tickets t LEFT JOIN customers c ON c.id = t.customer_id WHERE c.id IS NULL').then((r) => ['orphanTickets', Number(r.rows[0].count)]),
    pool.query('SELECT COUNT(*)::int AS count FROM support_ticket_messages m LEFT JOIN support_tickets t ON t.id = m.ticket_id WHERE t.id IS NULL').then((r) => ['orphanMessages', Number(r.rows[0].count)]),
    pool.query('SELECT COUNT(*)::int AS count FROM support_attachments a LEFT JOIN support_tickets t ON t.id = a.ticket_id WHERE t.id IS NULL').then((r) => ['orphanAttachments', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM support_attachments WHERE storage_key LIKE '/%' OR storage_key LIKE '%..%' OR storage_key LIKE '%\\\\%' ").then((r) => ['unsafeStorageKeys', Number(r.rows[0].count)]),
    pool.query("SELECT COUNT(*)::int AS count FROM support_ticket_messages WHERE body ~* '(LPA:|qrcode|qr code|pin|puk|iccid|password|token)' ").then((r) => ['sensitiveMessages', Number(r.rows[0].count)]),
  ]);
  const report = Object.fromEntries(checks);
  const status = Object.values(report).every((value) => value === 0) ? 'pass' : 'fail';
  return { status, ...report, publicAttachmentRoute: false, writesToSource: false, rawValuesInReport: false };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = process.env.DATABASE_URL ? createPostgresPool() : null;
  try { process.stdout.write(`${JSON.stringify(await validateSupportData({ pool }), null, 2)}\n`); }
  finally { await pool?.end(); }
}
