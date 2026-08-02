import crypto from 'node:crypto';

const now = () => new Date().toISOString();
const map = (row) => row ? {
  ...row.snapshot,
  orderId: row.order_id,
  status: row.status,
  currency: row.currency,
  subtotal: Number(row.subtotal),
  customerId: row.customer_id,
  ownershipStatus: row.ownership_status,
  guestEmailSnapshot: row.guest_email_snapshot,
  guestPhoneSnapshot: row.guest_phone_snapshot,
  claimedAt: row.claimed_at?.toISOString?.() ?? row.claimed_at,
  claimedBy: row.claimed_by,
  ownershipVersion: row.ownership_version,
  createdAt: row.created_at?.toISOString?.() ?? row.created_at,
} : null;

export const createPostgresOrderRepository = ({ pool } = {}) => {
  if (!pool) throw new Error('PostgreSQL pool is required for canonical orders.');
  const getWith = async (executor, where, values) => map((await executor.query(`SELECT * FROM orders ${where}`, values)).rows[0]);
  const customerFilter = (customerId, { status, operation, from, to } = {}) => {
    const values = [customerId];
    const clauses = ['customer_id = $1'];
    if (status) { values.push(status); clauses.push(`status = $${values.length}`); }
    if (operation) { values.push(operation); clauses.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(snapshot->'items', '[]'::jsonb)) item WHERE item->>'operation' = $${values.length})`); }
    if (from) { values.push(from); clauses.push(`created_at >= $${values.length}`); }
    if (to) { values.push(to); clauses.push(`created_at <= $${values.length}`); }
    return { values, where: clauses.join(' AND ') };
  };
  return {
    get(orderId) { return getWith(pool, 'WHERE order_id = $1', [orderId]); },
    async list() { return (await pool.query('SELECT * FROM orders ORDER BY created_at DESC')).rows.map(map); },
    async listForCustomer(customerId, { status, operation, from, to, page = 1, pageSize = 20, sort = 'newest' } = {}) {
      const filter = customerFilter(customerId, { status, operation, from, to });
      const limit = Math.min(100, Math.max(1, Number(pageSize) || 20));
      const offset = Math.max(0, (Number(page) || 1) - 1) * limit;
      filter.values.push(limit, offset);
      const direction = sort === 'oldest' ? 'ASC' : 'DESC';
      const result = await pool.query(`SELECT * FROM orders WHERE ${filter.where} ORDER BY created_at ${direction}, order_id ASC LIMIT $${filter.values.length - 1} OFFSET $${filter.values.length}`, filter.values);
      return result.rows.map(map);
    },
    async countForCustomer(customerId, query = {}) {
      const filter = customerFilter(customerId, query);
      const result = await pool.query(`SELECT COUNT(*)::int AS count FROM orders WHERE ${filter.where}`, filter.values);
      return result.rows[0]?.count ?? 0;
    },
    async summaryForCustomer(customerId) {
      const result = await pool.query(`
        WITH owned AS (SELECT * FROM orders WHERE customer_id = $1),
        totals AS (SELECT COALESCE(jsonb_object_agg(currency, amount), '{}'::jsonb) AS totals_by_currency FROM (SELECT currency, SUM(subtotal) AS amount FROM owned GROUP BY currency) grouped),
        counts AS (SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('PENDING', 'PROCESSING'))::int AS pending, COUNT(*) FILTER (WHERE status IN ('PROVISIONED', 'SHIPPED', 'COMPLETED'))::int AS completed, COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled, COALESCE(SUM((SELECT COALESCE(SUM(COALESCE((item->>'quantity')::int, 1)), 0) FROM jsonb_array_elements(COALESCE(snapshot->'items', '[]'::jsonb)) item)), 0)::int AS item_count FROM owned WHERE status IN ('PENDING', 'PROCESSING'))
        SELECT counts.*, totals.totals_by_currency FROM counts CROSS JOIN totals
      `, [customerId]);
      const row = result.rows[0] ?? {};
      return { total: row.total ?? 0, pending: row.pending ?? 0, completed: row.completed ?? 0, cancelled: row.cancelled ?? 0, pendingItems: row.item_count ?? 0, totalsByCurrency: row.totals_by_currency ?? {} };
    },
    getForCustomer(orderId, customerId) { return getWith(pool, 'WHERE order_id = $1 AND customer_id = $2', [orderId, customerId]); },
    async create(order) {
      const client = await pool.connect();
      const createdAt = order.createdAt ?? now();
      const ownershipStatus = order.ownershipStatus ?? (order.customerId ? 'OWNED' : 'GUEST_UNCLAIMED');
      try {
        await client.query('BEGIN');
        const inserted = await client.query('INSERT INTO orders (order_id, customer_id, ownership_status, guest_email_snapshot, guest_phone_snapshot, claimed_at, claimed_by, ownership_version, status, currency, subtotal, snapshot, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NULL,NULL,1,$6,$7,$8,$9,$10,$10) ON CONFLICT (order_id) DO NOTHING', [order.orderId, order.customerId ?? null, ownershipStatus, order.guestEmailSnapshot ?? null, order.guestPhoneSnapshot ?? null, order.status, order.currency, order.subtotal, JSON.stringify(order), createdAt]);
        if (!inserted.rowCount) { await client.query('COMMIT'); return this.get(order.orderId); }
        for (const [index, item] of (order.items ?? []).entries()) await client.query('INSERT INTO order_items (id, order_id, item_index, product_id, variant_id, quantity, unit_price, currency, snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (order_id, item_index) DO NOTHING', [crypto.randomUUID(), order.orderId, index, item.productId, item.variantId, item.quantity, item.unitPrice, item.currency, JSON.stringify(item)]);
        await client.query('INSERT INTO order_ownership_events (id, order_id, from_status, to_status, from_customer_id, to_customer_id, action, actor_type, actor_id, request_id, created_at) VALUES ($1,$2,NULL,$3,NULL,$4,$5,$6,$4,$7,$8) ON CONFLICT DO NOTHING', [crypto.randomUUID(), order.orderId, ownershipStatus, order.customerId ?? null, ownershipStatus === 'OWNED' ? 'ORDER_CREATED_AUTHENTICATED' : 'ORDER_CREATED_GUEST', 'SYSTEM', order.requestId ?? null, createdAt]);
        await client.query('COMMIT');
        return this.get(order.orderId);
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async update(orderId, updater) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await getWith(client, 'WHERE order_id = $1 FOR UPDATE', [orderId]);
        if (!current) { await client.query('COMMIT'); return null; }
        const next = typeof updater === 'function' ? await updater(current) : { ...current, ...updater };
        await client.query('UPDATE orders SET status=$2, snapshot=$3, updated_at=$4 WHERE order_id=$1', [orderId, next.status, JSON.stringify(next), now()]);
        await client.query('COMMIT');
        return this.get(orderId);
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async health() {
      try { await pool.query('SELECT 1 FROM orders LIMIT 1'); return { status: 'healthy', persistence: 'postgres' }; }
      catch { return { status: 'unhealthy', persistence: 'postgres' }; }
    },
  };
};
