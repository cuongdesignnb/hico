import crypto from 'node:crypto';
import { normalizeEmail } from '../auth/userRepository.js';

const hash = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest('hex');
const notFound = () => Object.assign(new Error('Order not found.'), { code: 'ORDER_NOT_FOUND' });

export const createCustomerOrderService = ({ pool, orderRepository, tokenDelivery = {}, env = process.env } = {}) => {
  const secret = env.CUSTOMER_TOKEN_SECRET ?? '';
  const ttlMinutes = Math.max(5, Number.parseInt(env.CUSTOMER_ORDER_CLAIM_TTL_MINUTES, 10) || 30);
  const claimHash = (value) => hash(secret, value);
  return {
    async list(customerId, query) { return orderRepository.listForCustomer(customerId, query); },
    async get(customerId, orderId) {
      const order = await orderRepository.getForCustomer(orderId, customerId);
      if (!order) throw notFound();
      return order;
    },
    async requestClaim({ customer, session, orderId, requestId }) {
      const order = await orderRepository.get(orderId);
      if (!order || order.ownershipStatus !== 'GUEST_UNCLAIMED' || !order.guestEmailSnapshot || normalizeEmail(order.guestEmailSnapshot) !== normalizeEmail(customer.email) || !secret) return null;
      const token = crypto.randomBytes(32).toString('base64url');
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + ttlMinutes * 60_000);
      await pool.query('INSERT INTO guest_order_claims (id, order_id, token_hash, contact_type, contact_value_hash, expires_at, requested_by_session_id, attempt_count, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8)', [crypto.randomUUID(), orderId, claimHash(token), 'email', claimHash(normalizeEmail(customer.email)), expiresAt, session.id, createdAt]);
      await pool.query('INSERT INTO order_ownership_events (id, order_id, to_status, action, actor_type, actor_id, request_id, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [crypto.randomUUID(), orderId, 'GUEST_UNCLAIMED', 'GUEST_CLAIM_REQUESTED', 'CUSTOMER', customer.id, requestId ?? null, JSON.stringify({ contact: 'email' }), createdAt]);
      await tokenDelivery.sendOrderClaim?.({ email: customer.email, token, orderId });
      return { token, expiresAt: expiresAt.toISOString() };
    },
    async confirmClaim({ customer, orderId, token, requestId }) {
      if (!secret || typeof token !== 'string' || !token) throw notFound();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const orderResult = await client.query('SELECT * FROM orders WHERE order_id=$1 FOR UPDATE', [orderId]);
        const order = orderResult.rows[0];
        if (!order || order.ownership_status !== 'GUEST_UNCLAIMED' || normalizeEmail(order.guest_email_snapshot ?? '') !== normalizeEmail(customer.email)) throw notFound();
        const claim = (await client.query('SELECT * FROM guest_order_claims WHERE order_id=$1 AND token_hash=$2 FOR UPDATE', [orderId, claimHash(token)])).rows[0];
        if (!claim || claim.consumed_at || new Date(claim.expires_at) <= new Date() || claim.contact_value_hash !== claimHash(normalizeEmail(customer.email))) throw notFound();
        const updated = await client.query("UPDATE orders SET customer_id=$2, ownership_status='OWNED', claimed_at=NOW(), claimed_by=$2, ownership_version=ownership_version+1, updated_at=NOW() WHERE order_id=$1 AND ownership_status='GUEST_UNCLAIMED' RETURNING *", [orderId, customer.id]);
        if (!updated.rowCount) throw notFound();
        await client.query('UPDATE guest_order_claims SET consumed_at=NOW(), attempt_count=attempt_count+1 WHERE id=$1', [claim.id]);
        await client.query('INSERT INTO order_ownership_events (id, order_id, from_status, to_status, from_customer_id, to_customer_id, action, actor_type, actor_id, request_id, created_at) VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$5,$8,NOW())', [crypto.randomUUID(), orderId, 'GUEST_UNCLAIMED', 'OWNED', customer.id, 'GUEST_CLAIM_CONFIRMED', 'CUSTOMER', requestId ?? null]);
        await client.query('COMMIT');
        return orderRepository.getForCustomer(orderId, customer.id);
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
  };
};
