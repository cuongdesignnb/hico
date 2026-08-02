import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebhookSignature, verifyWebhookSignature } from './webhookSignature.js';

test('webhook signature uses HMAC, timestamp window, and constant-time comparison', () => {
  const rawBody = JSON.stringify({ eventId: 'evt-1' });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createWebhookSignature({ rawBody, timestamp, secret: 'qa-secret' });
  assert.equal(verifyWebhookSignature({ rawBody, timestamp, signature, secret: 'qa-secret' }).valid, true);
  assert.equal(verifyWebhookSignature({ rawBody, timestamp, signature: `${signature}x`, secret: 'qa-secret' }).valid, false);
  assert.equal(verifyWebhookSignature({ rawBody, timestamp: '1', signature, secret: 'qa-secret' }).code, 'WEBHOOK_TIMESTAMP_EXPIRED');
});
