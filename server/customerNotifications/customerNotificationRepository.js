import { randomUUID } from 'node:crypto';

const mapNotification = (row) => row ? ({
  id: row.id,
  customerId: row.customer_id,
  type: row.type,
  title: row.title,
  message: row.message,
  status: row.status,
  dedupeKey: row.dedupe_key,
  entityType: row.entity_type,
  entityId: row.entity_id,
  actionPath: row.action_path,
  createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  readAt: row.read_at?.toISOString?.() ?? row.read_at,
  expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at,
}) : null;

export const createCustomerNotificationRepository = ({ pool, now = () => new Date() } = {}) => {
  if (!pool) throw new Error('PostgreSQL pool is required for customer notifications.');
  const insert = async (executor, notification) => {
    const values = [
      notification.id ?? randomUUID(), notification.customerId, notification.type, notification.title,
      notification.message, notification.status ?? 'UNREAD', notification.dedupeKey, notification.entityType ?? null,
      notification.entityId ?? null, notification.actionPath ?? null, notification.createdAt ?? now().toISOString(),
      notification.readAt ?? null, notification.expiresAt ?? null, JSON.stringify(notification.metadata ?? {}),
    ];
    const result = await executor.query(`
      INSERT INTO customer_notifications (
        id, customer_id, type, title, message, status, dedupe_key, entity_type,
        entity_id, action_path, created_at, read_at, expires_at, metadata_jsonb
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (customer_id, dedupe_key) DO NOTHING
      RETURNING *
    `, values);
    if (result.rowCount) return { notification: mapNotification(result.rows[0]), idempotent: false };
    const existing = await executor.query('SELECT * FROM customer_notifications WHERE customer_id = $1 AND dedupe_key = $2', [notification.customerId, notification.dedupeKey]);
    return { notification: mapNotification(existing.rows[0]), idempotent: true };
  };

  return {
    create(notification) { return insert(pool, notification); },
    createInTransaction(executor, notification) { return insert(executor, notification); },
    async list(customerId, { page = 1, pageSize = 20, status } = {}) {
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
      const safeSize = Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 20));
      const values = [customerId];
      const clauses = ['customer_id = $1', '(expires_at IS NULL OR expires_at > NOW())'];
      if (status) { values.push(status); clauses.push(`status = $${values.length}`); }
      values.push(safeSize, (safePage - 1) * safeSize);
      const [rows, count] = await Promise.all([
        pool.query(`SELECT * FROM customer_notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values),
        pool.query(`SELECT COUNT(*)::int AS count FROM customer_notifications WHERE ${clauses.join(' AND ')}`, values.slice(0, status ? 2 : 1)),
      ]);
      const totalItems = Number(count.rows[0]?.count ?? 0);
      return { items: rows.rows.map(mapNotification), pagination: { page: safePage, pageSize: safeSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / safeSize)) } };
    },
    async unreadCount(customerId) {
      const result = await pool.query("SELECT COUNT(*)::int AS count FROM customer_notifications WHERE customer_id = $1 AND status = 'UNREAD' AND (expires_at IS NULL OR expires_at > NOW())", [customerId]);
      return Number(result.rows[0]?.count ?? 0);
    },
    async markRead(id, customerId) {
      const result = await pool.query("UPDATE customer_notifications SET status = 'READ', read_at = COALESCE(read_at, $3) WHERE id = $1 AND customer_id = $2 AND status <> 'ARCHIVED' RETURNING *", [id, customerId, now().toISOString()]);
      if (result.rowCount) return mapNotification(result.rows[0]);
      const owned = await pool.query('SELECT id FROM customer_notifications WHERE id = $1 AND customer_id = $2', [id, customerId]);
      return owned.rowCount ? mapNotification((await pool.query('SELECT * FROM customer_notifications WHERE id = $1', [id])).rows[0]) : null;
    },
    async readAll(customerId) {
      const result = await pool.query("UPDATE customer_notifications SET status = 'READ', read_at = COALESCE(read_at, $2) WHERE customer_id = $1 AND status = 'UNREAD'", [customerId, now().toISOString()]);
      return result.rowCount;
    },
    async health() {
      try { await pool.query('SELECT 1 FROM customer_notifications LIMIT 1'); return { status: 'healthy', persistence: 'postgres' }; }
      catch { return { status: 'unhealthy', persistence: 'postgres' }; }
    },
  };
};

export { mapNotification };
