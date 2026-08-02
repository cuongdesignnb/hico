import { randomUUID } from 'node:crypto';

const mapEntry = (row) => row ? ({
  id: row.id,
  customerId: row.customer_id,
  type: row.type,
  points: Number(row.points),
  orderId: row.order_id,
  orderItemId: row.order_item_id,
  ruleId: row.rule_id,
  ruleVersion: row.rule_version,
  businessEventKey: row.business_event_key,
  idempotencyKey: row.idempotency_key,
  effectiveAt: row.effective_at?.toISOString?.() ?? row.effective_at,
  expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at,
  reversedEntryId: row.reversed_entry_id,
  metadata: row.metadata_jsonb ?? {},
  createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  createdByType: row.created_by_type,
  createdById: row.created_by_id,
}) : null;

const idempotencyConflict = () => Object.assign(new Error('Loyalty idempotency key conflicts with an existing entry.'), { code: 'LOYALTY_IDEMPOTENCY_CONFLICT', status: 409 });

const sameEntry = (entry, row) => entry.customerId === row.customer_id
  && entry.type === row.type
  && Number(entry.points) === Number(row.points)
  && (entry.orderId ?? null) === (row.order_id ?? null)
  && (entry.orderItemId ?? null) === (row.order_item_id ?? null)
  && entry.businessEventKey === row.business_event_key
  && entry.idempotencyKey === row.idempotency_key;

export const createLoyaltyLedgerRepository = ({ pool, now = () => new Date() } = {}) => {
  if (!pool) throw new Error('PostgreSQL pool is required for the loyalty ledger.');
  const ensureAccount = (customerId, executor = pool) => executor.query(
    'INSERT INTO loyalty_accounts (customer_id, status, created_at, updated_at) VALUES ($1, \'active\', $2, $2) ON CONFLICT (customer_id) DO UPDATE SET updated_at = EXCLUDED.updated_at RETURNING customer_id, status',
    [customerId, now().toISOString()],
  ).then((result) => result.rows[0]);

  const insertEntryWith = async (executor, entry) => {
    const values = [
      entry.id ?? randomUUID(), entry.customerId, entry.type, entry.points, entry.orderId ?? null,
      entry.orderItemId ?? null, entry.ruleId, entry.ruleVersion, entry.businessEventKey, entry.idempotencyKey,
      entry.effectiveAt ?? now().toISOString(), entry.expiresAt ?? null, entry.reversedEntryId ?? null,
      JSON.stringify(entry.metadata ?? {}), entry.createdAt ?? now().toISOString(), entry.createdByType ?? 'SYSTEM', entry.createdById ?? null,
    ];
    const inserted = await executor.query(`
      INSERT INTO loyalty_ledger (
        id, customer_id, type, points, order_id, order_item_id, rule_id, rule_version,
        business_event_key, idempotency_key, effective_at, expires_at, reversed_entry_id,
        metadata_jsonb, created_at, created_by_type, created_by_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING *
    `, values);
    if (inserted.rowCount) return { entry: mapEntry(inserted.rows[0]), idempotent: false };
    const existing = await executor.query('SELECT * FROM loyalty_ledger WHERE idempotency_key = $1 OR business_event_key = $2 ORDER BY created_at ASC LIMIT 1', [entry.idempotencyKey, entry.businessEventKey]);
    const row = existing.rows[0];
    if (!row || !sameEntry(entry, row)) throw idempotencyConflict();
    return { entry: mapEntry(row), idempotent: true };
  };

  return {
    ensureAccount,
    insertEntry(entry) { return insertEntryWith(pool, entry); },
    async findEarnEntry({ customerId, orderId, orderItemId } = {}) {
      const result = await pool.query("SELECT * FROM loyalty_ledger WHERE customer_id = $1 AND order_id = $2 AND order_item_id = $3 AND type = 'EARN' ORDER BY effective_at ASC, id ASC LIMIT 1", [customerId, orderId, orderItemId]);
      return mapEntry(result.rows[0]);
    },
    async reverseEntry({ originalId, idempotencyKey, businessEventKey, customerId, reason, actorType = 'SYSTEM', actorId = null, effectiveAt } = {}) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query('SELECT * FROM loyalty_ledger WHERE id = $1 AND customer_id = $2 FOR UPDATE', [originalId, customerId]);
        const original = found.rows[0];
        if (!original || original.type !== 'EARN') throw Object.assign(new Error('Loyalty entry was not found.'), { code: 'LOYALTY_ENTRY_NOT_FOUND', status: 404 });
        await ensureAccount(customerId, client);
        const result = await insertEntryWith(client, {
          customerId,
          type: 'REVERSE',
          points: -Math.abs(Number(original.points)),
          orderId: original.order_id,
          orderItemId: original.order_item_id,
          ruleId: original.rule_id,
          ruleVersion: original.rule_version,
          businessEventKey: businessEventKey ?? `reverse:${original.id}:${reason ?? 'event'}`,
          idempotencyKey: idempotencyKey ?? `reverse:${original.id}:${reason ?? 'event'}`,
          effectiveAt,
          reversedEntryId: original.id,
          metadata: { reason: String(reason ?? 'business_event').slice(0, 160) },
          createdByType: actorType,
          createdById: actorId,
        });
        await client.query('COMMIT');
        return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async getBalance(customerId) {
      const result = await pool.query(`
        SELECT
          COALESCE(SUM(points), 0)::int AS balance,
          COALESCE(SUM(points) FILTER (WHERE type = 'EARN'), 0)::int AS earned,
          COALESCE(SUM(points) FILTER (WHERE type IN ('REDEEM', 'RESERVE')), 0)::int AS redeemed,
          COALESCE(SUM(points) FILTER (WHERE type = 'REVERSE'), 0)::int AS reversed,
          COUNT(*)::int AS entry_count
        FROM loyalty_ledger WHERE customer_id = $1
      `, [customerId]);
      const row = result.rows[0] ?? {};
      return { balance: Number(row.balance ?? 0), earned: Number(row.earned ?? 0), redeemed: Math.abs(Number(row.redeemed ?? 0)), reversed: Math.abs(Number(row.reversed ?? 0)), entryCount: Number(row.entry_count ?? 0), reserved: 0 };
    },
    async listTransactions(customerId, { page = 1, pageSize = 20 } = {}) {
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
      const safeSize = Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 20));
      const offset = (safePage - 1) * safeSize;
      const [rows, count] = await Promise.all([
        pool.query('SELECT * FROM loyalty_ledger WHERE customer_id = $1 ORDER BY effective_at DESC, id DESC LIMIT $2 OFFSET $3', [customerId, safeSize, offset]),
        pool.query('SELECT COUNT(*)::int AS count FROM loyalty_ledger WHERE customer_id = $1', [customerId]),
      ]);
      const totalItems = Number(count.rows[0]?.count ?? 0);
      return { items: rows.rows.map(mapEntry), pagination: { page: safePage, pageSize: safeSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / safeSize)) } };
    },
    async reconcile(customerId = null) {
      const values = customerId ? [customerId] : [];
      const where = customerId ? 'WHERE customer_id = $1' : '';
      const result = await pool.query(`SELECT customer_id, COALESCE(SUM(points), 0)::int AS ledger_balance FROM loyalty_ledger ${where} GROUP BY customer_id`, values);
      return { cachedBalanceEnabled: false, checkedAccounts: result.rowCount, mismatches: [], source: 'SUM(loyalty_ledger.points)' };
    },
    async health() {
      try { await pool.query('SELECT 1 FROM loyalty_accounts LIMIT 1'); await pool.query('SELECT 1 FROM loyalty_ledger LIMIT 1'); return { status: 'healthy', persistence: 'postgres' }; }
      catch { return { status: 'unhealthy', persistence: 'postgres' }; }
    },
  };
};

export { mapEntry };
