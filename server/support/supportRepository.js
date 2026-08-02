import { randomUUID } from 'node:crypto';

const iso = (value) => value?.toISOString?.() ?? value ?? null;
const mapTicket = (row) => row ? ({
  id: row.id, customerId: row.customer_id, subject: row.subject, category: row.category,
  status: row.status, priority: row.priority, orderId: row.order_id, customerAssetId: row.customer_asset_id,
  assignedAdminId: row.assigned_admin_id, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), closedAt: iso(row.closed_at),
}) : null;
const mapMessage = (row) => row ? ({ id: row.id, ticketId: row.ticket_id, senderType: row.sender_type, senderCustomerId: row.sender_customer_id, senderAdminId: row.sender_admin_id, visibility: row.visibility, body: row.body, createdAt: iso(row.created_at), editedAt: iso(row.edited_at) }) : null;
const mapAttachment = (row) => row ? ({ id: row.id, ticketId: row.ticket_id, messageId: row.message_id, uploadedByType: row.uploaded_by_type, originalName: row.original_name_safe, mimeType: row.mime_type, sizeBytes: row.size_bytes, checksum: row.checksum, status: row.status, createdAt: iso(row.created_at) }) : null;

export const createSupportRepository = ({ pool, now = () => new Date() } = {}) => {
  if (!pool) throw new Error('PostgreSQL pool is required for support.');
  const withTransaction = async (callback) => { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } };
  const ticket = async (executor, id, customerId = null) => {
    const values = customerId ? [id, customerId] : [id];
    const where = customerId ? 'WHERE id = $1 AND customer_id = $2' : 'WHERE id = $1';
    const result = await executor.query(`SELECT * FROM support_tickets ${where}`, values);
    return mapTicket(result.rows[0]);
  };
  const messages = async (executor, ticketId, includeInternal = false) => {
    const result = await executor.query(`SELECT * FROM support_ticket_messages WHERE ticket_id = $1 ${includeInternal ? '' : "AND visibility = 'CUSTOMER'"} ORDER BY created_at ASC, id ASC`, [ticketId]);
    return result.rows.map(mapMessage);
  };
  const attachments = async (executor, ticketId) => {
    const result = await executor.query("SELECT * FROM support_attachments WHERE ticket_id = $1 AND status <> 'DELETED' ORDER BY created_at DESC, id DESC", [ticketId]);
    return result.rows.map(mapAttachment);
  };
  const detail = async (executor, id, customerId = null, includeInternal = false) => {
    const result = await ticket(executor, id, customerId);
    if (!result) return null;
    return { ticket: result, messages: await messages(executor, id, includeInternal), attachments: await attachments(executor, id) };
  };

  return {
    async createTicket({ customerId, subject, category, priority, orderId = null, customerAssetId = null, body }) {
      return withTransaction(async (client) => {
        const timestamp = now().toISOString();
        const id = randomUUID();
        await client.query('INSERT INTO support_tickets (id, customer_id, subject, category, status, priority, order_id, customer_asset_id, assigned_admin_id, created_at, updated_at, closed_at) VALUES ($1,$2,$3,$4,\'OPEN\',$5,$6,$7,NULL,$8,$8,NULL)', [id, customerId, subject, category, priority ?? 'NORMAL', orderId, customerAssetId, timestamp]);
        const messageId = randomUUID();
        await client.query("INSERT INTO support_ticket_messages (id, ticket_id, sender_type, sender_customer_id, sender_admin_id, visibility, body, created_at, edited_at) VALUES ($1,$2,'CUSTOMER',$3,NULL,'CUSTOMER',$4,$5,NULL)", [messageId, id, customerId, body, timestamp]);
        return detail(client, id, customerId);
      });
    },
    async listForCustomer(customerId, { page = 1, pageSize = 20, status } = {}) {
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1); const safeSize = Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 20));
      const values = [customerId]; const clauses = ['customer_id = $1'];
      if (status) { values.push(status); clauses.push(`status = $${values.length}`); }
      const [rows, count] = await Promise.all([pool.query(`SELECT * FROM support_tickets WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC, id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, safeSize, (safePage - 1) * safeSize]), pool.query(`SELECT COUNT(*)::int AS count FROM support_tickets WHERE ${clauses.join(' AND ')}`, values)]);
      const totalItems = Number(count.rows[0]?.count ?? 0);
      return { items: rows.rows.map(mapTicket), pagination: { page: safePage, pageSize: safeSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / safeSize)) } };
    },
    getForCustomer(customerId, id) { return detail(pool, id, customerId); },
    getForAdmin(id) { return detail(pool, id, null, true); },
    async addMessage({ ticketId, senderType, senderCustomerId = null, senderAdminId = null, visibility = 'CUSTOMER', body }) {
      return withTransaction(async (client) => {
        const current = await ticket(client, ticketId);
        if (!current) return null;
        if (current.status === 'CLOSED') throw Object.assign(new Error('Support ticket is closed.'), { code: 'SUPPORT_TICKET_CLOSED' });
        const timestamp = now().toISOString();
        await client.query('INSERT INTO support_ticket_messages (id, ticket_id, sender_type, sender_customer_id, sender_admin_id, visibility, body, created_at, edited_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL)', [randomUUID(), ticketId, senderType, senderCustomerId, senderAdminId, visibility, body, timestamp]);
        await client.query('UPDATE support_tickets SET status = CASE WHEN $2 = \'CUSTOMER\' THEN \'OPEN\' WHEN status = \'OPEN\' THEN \'IN_PROGRESS\' ELSE status END, updated_at = $3 WHERE id = $1', [ticketId, senderType, timestamp]);
        return detail(client, ticketId, null, true);
      });
    },
    async closeForCustomer(customerId, id) {
      const result = await pool.query("UPDATE support_tickets SET status = 'CLOSED', closed_at = $3, updated_at = $3 WHERE id = $1 AND customer_id = $2 AND status <> 'CLOSED' RETURNING *", [id, customerId, now().toISOString()]);
      return mapTicket(result.rows[0]);
    },
    async adminUpdate(id, update) {
      const current = await ticket(pool, id); if (!current) return null;
      const fields = []; const values = [];
      if (Object.hasOwn(update, 'status')) { values.push(update.status); fields.push(`status = $${values.length}`); }
      if (Object.hasOwn(update, 'priority')) { values.push(update.priority); fields.push(`priority = $${values.length}`); }
      if (Object.hasOwn(update, 'assignedAdminId')) { values.push(update.assignedAdminId); fields.push(`assigned_admin_id = $${values.length}`); }
      if (!fields.length) return current;
      const timestamp = now().toISOString(); values.push(timestamp, id); fields.push(`updated_at = $${values.length - 1}`);
      if (update.status === 'CLOSED') { values.push(timestamp); fields.push(`closed_at = $${values.length}`); }
      const result = await pool.query(`UPDATE support_tickets SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
      return mapTicket(result.rows[0]);
    },
    async createAttachment(attachment) {
      const result = await pool.query('INSERT INTO support_attachments (id, ticket_id, message_id, uploaded_by_type, uploaded_by_id, storage_key, original_name_safe, mime_type, size_bytes, checksum, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [attachment.id ?? randomUUID(), attachment.ticketId, attachment.messageId ?? null, attachment.uploadedByType, attachment.uploadedById, attachment.storageKey, attachment.originalNameSafe, attachment.mimeType, attachment.sizeBytes, attachment.checksum, attachment.status ?? 'AVAILABLE', attachment.createdAt ?? now().toISOString()]);
      return mapAttachment(result.rows[0]);
    },
    async countAttachments(ticketId) {
      const result = await pool.query("SELECT COUNT(*)::int AS count FROM support_attachments WHERE ticket_id = $1 AND status <> 'DELETED'", [ticketId]);
      return Number(result.rows[0]?.count ?? 0);
    },
    getAttachment(id) { return pool.query('SELECT a.*, t.customer_id FROM support_attachments a JOIN support_tickets t ON t.id = a.ticket_id WHERE a.id = $1', [id]).then((result) => result.rows[0] ? { ...mapAttachment(result.rows[0]), customerId: result.rows[0].customer_id, storageKey: result.rows[0].storage_key } : null); },
    async listForAdmin({ page = 1, pageSize = 30, status } = {}) {
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1); const safeSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 30)); const values = []; const clauses = [];
      if (status) { values.push(status); clauses.push(`status = $${values.length}`); }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const [rows, count] = await Promise.all([pool.query(`SELECT * FROM support_tickets ${where} ORDER BY updated_at DESC, id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, safeSize, (safePage - 1) * safeSize]), pool.query(`SELECT COUNT(*)::int AS count FROM support_tickets ${where}`, values)]);
      const totalItems = Number(count.rows[0]?.count ?? 0); return { items: rows.rows.map(mapTicket), pagination: { page: safePage, pageSize: safeSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / safeSize)) } };
    },
    async health() { try { await pool.query('SELECT 1 FROM support_tickets LIMIT 1'); await pool.query('SELECT 1 FROM support_attachments LIMIT 1'); return { status: 'healthy', persistence: 'postgres' }; } catch { return { status: 'unhealthy', persistence: 'postgres' }; } },
  };
};

export { mapTicket, mapMessage, mapAttachment };
