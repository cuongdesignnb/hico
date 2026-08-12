import { randomUUID } from 'node:crypto';

const mapTransaction = (row) => row ? ({
  id: row.id,
  provider: row.provider,
  providerTransactionId: row.provider_transaction_id,
  orderId: row.order_id,
  status: row.status,
  matchStatus: row.match_status,
  amount: Number(row.amount),
  currency: row.currency,
  accountMasked: row.account_masked,
  referenceCode: row.reference_code,
  payloadHash: row.payload_hash,
  createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  paidAt: row.paid_at?.toISOString?.() ?? row.paid_at ?? null,
}) : null;

const maskAccount = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, '');
  return normalized ? `****${normalized.slice(-4)}` : null;
};

export const createInMemorySePayPaymentRepository = ({ orders = [] } = {}) => {
  const orderMap = new Map(orders.map((order) => [order.orderId, { ...order, paymentStatus: order.paymentStatus ?? 'PENDING' }]));
  const events = new Map();
  const transactions = new Map();
  return {
    async findOrder(orderId) { return orderMap.get(orderId) ?? null; },
    async processPayment(input) {
      if (events.has(input.providerTransactionId) || transactions.has(input.providerTransactionId)) return { idempotent: true, transaction: transactions.get(input.providerTransactionId) };
      const transaction = { id: randomUUID(), provider: 'SEPAY', providerTransactionId: input.providerTransactionId, orderId: input.orderId ?? null, status: input.outcome === 'PAID' ? 'PAID' : 'MANUAL_REVIEW', matchStatus: input.outcome === 'PAID' ? 'MATCHED' : 'REVIEW', amount: input.amount, currency: 'VND', accountMasked: maskAccount(input.accountNumber), referenceCode: input.referenceCode ?? null, payloadHash: input.payloadHash, createdAt: new Date().toISOString(), paidAt: input.outcome === 'PAID' ? new Date().toISOString() : null };
      events.set(input.providerTransactionId, transaction);
      transactions.set(input.providerTransactionId, transaction);
      if (input.outcome === 'PAID' && input.orderId) {
        const order = orderMap.get(input.orderId);
        if (order?.paymentStatus === 'PENDING') {
          order.paymentStatus = 'PAID';
          order.providerTransactionId = input.providerTransactionId;
          order.paidAmount = input.amount;
          order.paidCurrency = 'VND';
          order.paidAt = transaction.paidAt;
        } else {
          transaction.status = 'MANUAL_REVIEW';
          transaction.matchStatus = 'ALREADY_PAID';
        }
      }
      return { idempotent: false, transaction };
    },
    async listTransactions({ page = 1, pageSize = 50 } = {}) {
      const all = [...transactions.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
      const safeSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 50));
      return { items: all.slice((safePage - 1) * safeSize, safePage * safeSize), pagination: { page: safePage, pageSize: safeSize, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / safeSize)) } };
    },
  };
};

export const createUnavailableSePayPaymentRepository = () => ({
  async findOrder() { return null; },
  async processPayment() { throw Object.assign(new Error('SePay payment persistence requires PostgreSQL.'), { code: 'SEPAY_PAYMENT_UNAVAILABLE', status: 503 }); },
  async listTransactions() { throw Object.assign(new Error('SePay payment persistence requires PostgreSQL.'), { code: 'SEPAY_PAYMENT_UNAVAILABLE', status: 503 }); },
});

export const createSePayPaymentRepository = ({ pool } = {}) => {
  if (!pool) return createUnavailableSePayPaymentRepository();
  return {
    async findOrder(orderId) {
      if (!orderId) return null;
      const result = await pool.query('SELECT order_id, currency, subtotal, payment_status, provider_transaction_id FROM orders WHERE order_id = $1', [orderId]);
      return result.rows[0] ?? null;
    },
    async processPayment(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const event = await client.query(`INSERT INTO payment_webhook_events (id, provider, provider_event_id, payload_hash, status, metadata, received_at) VALUES ($1,'SEPAY',$2,$3,$4,$5,NOW()) ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`, [randomUUID(), input.providerTransactionId, input.payloadHash, input.outcome === 'PAID' ? 'MATCHED' : 'MANUAL_REVIEW', JSON.stringify({ referenceCode: input.referenceCode ?? null, orderId: input.orderId ?? null })]);
        if (!event.rowCount) {
          await client.query('ROLLBACK');
          return { idempotent: true };
        }
        const inserted = await client.query(`INSERT INTO payment_transactions (id, provider, provider_transaction_id, order_id, status, match_status, amount, currency, account_masked, reference_code, payload_hash, created_at, paid_at) VALUES ($1,'SEPAY',$2,$3,$4,$5,$6,'VND',$7,$8,$9,NOW(),CASE WHEN $4='PAID' THEN NOW() ELSE NULL END) ON CONFLICT (provider, provider_transaction_id) DO NOTHING RETURNING *`, [randomUUID(), input.providerTransactionId, input.orderId ?? null, input.outcome === 'PAID' ? 'PAID' : 'MANUAL_REVIEW', input.outcome === 'PAID' ? 'MATCHED' : 'REVIEW', input.amount, maskAccount(input.accountNumber), input.referenceCode ?? null, input.payloadHash]);
        if (!inserted.rowCount) {
          await client.query('COMMIT');
          return { idempotent: true };
        }
        let finalTransaction = inserted.rows[0];
        if (input.outcome === 'PAID' && input.orderId) {
          const updated = await client.query(`UPDATE orders SET payment_status='PAID', payment_provider='SEPAY', provider_transaction_id=$2, paid_amount=$3, paid_currency='VND', paid_at=NOW(), updated_at=NOW() WHERE order_id=$1 AND payment_status='PENDING' RETURNING order_id`, [input.orderId, input.providerTransactionId, input.amount]);
          if (!updated.rowCount) {
            await client.query("UPDATE payment_transactions SET status='MANUAL_REVIEW', match_status='ALREADY_PAID' WHERE provider='SEPAY' AND provider_transaction_id=$1", [input.providerTransactionId]);
            finalTransaction = { ...finalTransaction, status: 'MANUAL_REVIEW', match_status: 'ALREADY_PAID' };
          }
        }
        await client.query('COMMIT');
        return { idempotent: false, transaction: mapTransaction(finalTransaction) };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async listTransactions({ page = 1, pageSize = 50 } = {}) {
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
      const safeSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 50));
      const offset = (safePage - 1) * safeSize;
      const [items, count] = await Promise.all([
        pool.query('SELECT * FROM payment_transactions WHERE provider=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', ['SEPAY', safeSize, offset]),
        pool.query('SELECT COUNT(*)::int AS count FROM payment_transactions WHERE provider=$1', ['SEPAY']),
      ]);
      const total = count.rows[0]?.count ?? 0;
      return { items: items.rows.map(mapTransaction), pagination: { page: safePage, pageSize: safeSize, total, totalPages: Math.max(1, Math.ceil(total / safeSize)) } };
    },
  };
};
