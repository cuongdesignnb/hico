import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { createPostgresPool } from '../database/postgresPool.js';

const source = path.join(defaultUploadsDirectory, 'orders.json');
const normalize = (value) => Array.isArray(value) ? value : Object.values(value ?? {});

export const inspectLegacyOrders = async ({ filePath = source } = {}) => {
  const orders = normalize(await readJson(filePath, []));
  return { source: filePath, totalOrders: orders.length, owned: 0, guestUnclaimed: 0, legacyUnresolved: orders.length, manualReview: 0, conflicts: 0, autoAssignments: 0, ownership: { LEGACY_UNRESOLVED: orders.length, autoLinkedByEmail: 0 } };
};

export const importLegacyOrders = async ({ pool = createPostgresPool(), filePath = source, dryRun = true } = {}) => {
  const report = await inspectLegacyOrders({ filePath });
  if (dryRun) return { ...report, dryRun: true, imported: 0 };
  const orders = normalize(await readJson(filePath, []));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const order of orders) {
      const id = order.orderId;
      if (!id) continue;
      await client.query("INSERT INTO orders (order_id, customer_id, ownership_status, guest_email_snapshot, guest_phone_snapshot, ownership_version, status, currency, subtotal, snapshot, created_at, updated_at) VALUES ($1,NULL,'LEGACY_UNRESOLVED',NULL,NULL,1,$2,$3,$4,$5,NOW(),NOW()) ON CONFLICT (order_id) DO NOTHING", [id, order.status ?? 'PENDING_CALLBACK', order.currency ?? 'VND', Number(order.subtotal ?? 0), JSON.stringify(order)]);
      for (const [index, item] of (order.items ?? []).entries()) await client.query('INSERT INTO order_items (id, order_id, item_index, product_id, variant_id, quantity, unit_price, currency, snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (order_id, item_index) DO NOTHING', [randomUUID(), id, index, item.productId ?? 'legacy', item.variantId ?? item.wmproductId ?? `legacy-${index}`, Number(item.quantity ?? 1), Number(item.unitPrice ?? 0), order.currency ?? 'VND', JSON.stringify(item)]);
      await client.query("INSERT INTO order_ownership_events (id, order_id, to_status, action, actor_type, metadata, created_at) SELECT $2, $1, 'LEGACY_UNRESOLVED', 'MIGRATION_MARKED_UNRESOLVED', 'MIGRATION', '{\"source\":\"legacy_json\"}'::jsonb, NOW() WHERE NOT EXISTS (SELECT 1 FROM order_ownership_events WHERE order_id=$1 AND action='MIGRATION_MARKED_UNRESOLVED')", [id, randomUUID()]);
    }
    await client.query('COMMIT');
    return { ...report, dryRun: false, imported: orders.length };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await importLegacyOrders({ dryRun: !process.argv.includes('--write') });
  console.log(JSON.stringify(result));
}
