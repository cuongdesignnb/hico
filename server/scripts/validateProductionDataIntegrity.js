import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCanonicalCatalogStorage } from '../catalog/health/catalogStartupValidator.js';
import { createPostgresPool } from '../database/postgresPool.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploads = path.join(serverRoot, 'uploads');
const read = async (name) => JSON.parse(await fs.readFile(path.join(uploads, name), 'utf8'));
const duplicateValues = (items, key) => {
  const seen = new Set(); const duplicates = new Set();
  for (const item of items) { const value = item?.[key]; if (!value) continue; if (seen.has(value)) duplicates.add(value); seen.add(value); }
  return [...duplicates];
};

export const validateProductionDataIntegrity = async ({ env = process.env } = {}) => {
  const blockers = []; const warnings = [];
  try { await validateCanonicalCatalogStorage({ uploadsDirectory: uploads }); } catch (error) { blockers.push(error.code ?? 'CATALOG_INTEGRITY_INVALID'); }
  const [orders, manualQrs] = await Promise.all([read('orders.json'), read('manual_qrs.json')]);
  if (duplicateValues(orders, 'id').length || duplicateValues(orders, 'orderId').length) blockers.push('DUPLICATE_ORDER_ID');
  const assigned = manualQrs.filter((item) => item.assignedOrderId);
  if (duplicateValues(assigned, 'id').length) blockers.push('DUPLICATE_QR_ID');
  if (assigned.some((item) => !orders.some((order) => (order.id ?? order.orderId) === item.assignedOrderId))) warnings.push('ORPHAN_QR_ASSIGNMENT');
  const destinationRows = await read('destinations.json');
  const variants = destinationRows.flatMap((item) => item.variants ?? []);
  if (variants.some((variant) => Number(variant.stock ?? 0) < 0)) blockers.push('NEGATIVE_STOCK');
  if (env.DATABASE_URL) {
    const pool = createPostgresPool({ env });
    try {
      const [orphanSessions, cleanupBacklog] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS count FROM admin_sessions s LEFT JOIN admin_users u ON u.id = s.user_id WHERE u.id IS NULL'),
        pool.query('SELECT COUNT(*)::int AS count FROM admin_sessions WHERE expires_at < NOW()'),
      ]);
      if (orphanSessions.rows[0].count) blockers.push('ORPHAN_ADMIN_SESSION');
      if (cleanupBacklog.rows[0].count) warnings.push('EXPIRED_SESSION_CLEANUP_BACKLOG');
    } catch { blockers.push('AUTH_DATASTORE_UNAVAILABLE'); } finally { await pool.end(); }
  }
  return { status: blockers.length ? 'blocked' : 'passed', blockers, warnings, checkedAt: new Date().toISOString() };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await validateProductionDataIntegrity()));
