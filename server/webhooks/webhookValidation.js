import crypto from 'node:crypto';
import { CheckoutError } from '../checkout/checkoutError.js';

export const normalizeWebhookEvent = (payload, rawBody) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CheckoutError('Webhook payload không hợp lệ.', 'WEBHOOK_INVALID_PAYLOAD', 400);
  }
  const eventId = String(payload.eventId ?? payload.id ?? '').trim();
  const providerOrderId = String(payload.providerOrderId ?? payload.orderId ?? '').trim();
  if (!eventId || !providerOrderId) {
    throw new CheckoutError('Webhook thiếu event ID hoặc provider order.', 'WEBHOOK_INVALID_PAYLOAD', 400);
  }
  return {
    ...payload,
    eventId,
    providerOrderId,
    payloadHash: crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex'),
    eventType: payload.eventType ?? 'FULFILLMENT_CALLBACK',
  };
};
