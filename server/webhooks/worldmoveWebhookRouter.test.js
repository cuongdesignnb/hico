import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { createWebhookSignature } from './webhookSignature.js';
import { createWorldmoveRawCallbackSignature } from './worldmoveRawCallback.js';
import { createWorldmoveWebhookRouter } from './worldmoveWebhookRouter.js';

const merchantId = 'b000024';
const token = 'worldmove-test-token';

const createReplayRepository = () => {
  const keys = new Set();
  return {
    async add(key) {
      if (keys.has(key)) return { fresh: false };
      keys.add(key);
      return { fresh: true };
    },
    async remove(key) { keys.delete(key); },
  };
};

const createApp = ({ fulfillmentService, replayRepository, env }) => {
  const app = express();
  app.use('/api/webhooks/worldmove', express.raw({ type: 'application/json' }));
  app.use('/api/webhooks/worldmove', createWorldmoveWebhookRouter({ fulfillmentService, replayRepository, env }));
  return app;
};

const request = (app, payload, headers = {}) => new Promise((resolve, reject) => {
  const server = app.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/webhooks/worldmove/events',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rawBody), ...headers },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => server.close(() => resolve({ status: res.statusCode, body, headers: res.headers })));
    });
    req.on('error', (error) => server.close(() => reject(error)));
    req.end(rawBody);
  });
});

const signedRawPayload = () => {
  const payload = {
    rcode: 'RC-ROUTER',
    qrcodeType: 2,
    qrcode: 'https://example.test/qr-router',
    resultcode: '000',
  };
  payload.encStr = createWorldmoveRawCallbackSignature({ callbackType: 'REDEEM_CALLBACK_3_2', payload, merchantId, token });
  return payload;
};

test('raw callback is acknowledged and duplicate is processed once', async () => {
  let calls = 0;
  const app = createApp({
    env: { WORLDMOVE_MERCHANT_ID: merchantId, WORLDMOVE_TOKEN: token },
    replayRepository: createReplayRepository(),
    fulfillmentService: {
      async handleWebhookEvent(event) {
        calls += 1;
        assert.equal(event.redemptionCode, 'RC-ROUTER');
        return { duplicate: false, orderId: 'order-1', status: 'PROVISIONED' };
      },
    },
  });
  const payload = signedRawPayload();
  const first = await request(app, payload);
  const second = await request(app, payload);

  assert.equal(first.status, 200);
  assert.equal(first.body, '1');
  assert.equal(second.status, 200);
  assert.equal(second.body, '1');
  assert.equal(calls, 1);
});

test('tampered raw callback returns 401', async () => {
  const app = createApp({
    env: { WORLDMOVE_MERCHANT_ID: merchantId, WORLDMOVE_TOKEN: token },
    replayRepository: createReplayRepository(),
    fulfillmentService: { async handleWebhookEvent() { throw new Error('must not process'); } },
  });
  const payload = signedRawPayload();
  const response = await request(app, { ...payload, qrcode: 'https://example.test/tampered' });

  assert.equal(response.status, 401);
});

test('internal HMAC callback remains compatible', async () => {
  const secret = 'internal-webhook-secret';
  const payload = { eventId: 'evt-internal-1', providerOrderId: 'WM-INTERNAL', itemList: [] };
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const app = createApp({
    env: { WORLDMOVE_WEBHOOK_SECRET: secret },
    replayRepository: createReplayRepository(),
    fulfillmentService: {
      async handleWebhookEvent(event) {
        assert.equal(event.eventId, 'evt-internal-1');
        return { duplicate: false, orderId: 'order-internal', status: 'PROVISIONED' };
      },
    },
  });
  const response = await request(app, rawBody, {
    'X-Worldmove-Timestamp': timestamp,
    'X-Worldmove-Signature': createWebhookSignature({ rawBody, timestamp, secret }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    ok: true,
    duplicate: false,
    orderId: 'order-internal',
    status: 'PROVISIONED',
  });
});
