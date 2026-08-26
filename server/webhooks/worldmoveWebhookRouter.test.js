import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createEsimOrderCallbackSignature,
  createEsimRedeemCallbackSignature,
  createRedeemCallbackSignature,
  createTopupCallbackSignature,
} from '../providers/worldmove/worldmoveSignature.js';
import { createWorldmoveWebhookRouter } from './worldmoveWebhookRouter.js';
import { createWebhookReplayRepository } from './webhookReplayRepository.js';

const withServer = async (router, callback) => {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0);
  await once(server, 'listening');
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); await once(server, 'close'); }
};

test('Worldmove callback acknowledges valid and replayed events with text 1', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-worldmove-webhook-'));
  let handled = 0;
  const payload = {
    orderId: 'WM-DIRECT',
    itemList: [{ iccid: '8985204000012345678', productName: 'eSIM', rcode: 'RC-1', qrcodeType: 2, qrcode: 'qr-value', resultcode: '000' }],
  };
  payload.encStr = createEsimRedeemCallbackSignature({ ...payload, merchantId: 'M', token: 'T' });
  const router = createWorldmoveWebhookRouter({
    merchantId: 'M',
    token: 'T',
    env: {},
    fulfillmentService: { async handleWebhookEvent() { handled += 1; return { orderId: 'order-1', status: 'PROVISIONED' }; } },
    replayRepository: createWebhookReplayRepository({ filePath: path.join(directory, 'replay.json') }),
  });
  try {
    await withServer(router, async (baseUrl) => {
      const send = () => fetch(`${baseUrl}/api/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const first = await send();
      assert.equal(first.status, 200);
      assert.equal(await first.text(), '1');
      assert.match(first.headers.get('content-type') ?? '', /^text\/plain/);
      const duplicate = await send();
      assert.equal(duplicate.status, 200);
      assert.equal(await duplicate.text(), '1');
    });
    assert.equal(handled, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Worldmove callback route fails closed when provider credentials are missing', async () => {
  const router = createWorldmoveWebhookRouter({
    merchantId: '',
    token: '',
    env: { WORLDMOVE_WEBHOOK_SECRET: 'internal-only-secret' },
    fulfillmentService: { async handleWebhookEvent() { throw new Error('must not handle'); } },
    replayRepository: { async add() { throw new Error('must not persist'); } },
  });
  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ arbitrary: true }) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Worldmove webhook integration is not configured.', code: 'WORLDMOVE_WEBHOOK_NOT_READY' });
  });
});

test('Worldmove callback variants all acknowledge with text 1', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-worldmove-callbacks-'));
  let handled = 0;
  const common = { merchantId: 'M', token: 'T' };
  const order = {
    orderId: 'WM-ORDER',
    orderSN: 'SN-1',
    orderTime: '2026-08-26 10:00:00',
    code: 0,
    msg: 'success',
    itemList: [{ iccid: '8985204000012345678', productName: 'eSIM', redemptionCode: 'RC-ORDER' }],
  };
  order.encStr = createEsimOrderCallbackSignature({ ...order, ...common });
  const direct = {
    orderId: 'WM-DIRECT',
    itemList: [{ iccid: '8985204000012345679', productName: 'eSIM', rcode: 'RC-DIRECT', qrcodeType: 2, qrcode: 'qr-value', resultcode: '000' }],
  };
  direct.encStr = createEsimRedeemCallbackSignature({ ...direct, ...common });
  const redeem = { rcode: 'RC-REDEEM', qrcodeType: 2, qrcode: 'qr-value' };
  redeem.encStr = createRedeemCallbackSignature({ ...redeem, ...common });
  const topup = { orderId: 'WM-TOPUP', itemList: [{ wmproductId: 'WM-TOPUP', day: 7, simNum: '12345678901234567890', code: 1 }] };
  topup.encStr = createTopupCallbackSignature({ ...topup, ...common });
  const router = createWorldmoveWebhookRouter({
    ...common,
    env: {},
    fulfillmentService: { async handleWebhookEvent() { handled += 1; return { orderId: 'order-1', status: 'PROVISIONED' }; } },
    replayRepository: createWebhookReplayRepository({ filePath: path.join(directory, 'replay.json') }),
  });
  try {
    await withServer(router, async (baseUrl) => {
      for (const payload of [order, direct, redeem, topup]) {
        const response = await fetch(`${baseUrl}/api/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        assert.equal(response.status, 200);
        assert.equal(await response.text(), '1');
        assert.match(response.headers.get('content-type') ?? '', /^text\/plain/);
      }
    });
    assert.equal(handled, 4);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
