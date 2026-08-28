import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createWorldmoveClient } from './worldmoveClient.js';
import {
  createWorldmoveEsimOrderThenRedeemStrategy,
} from '../../fulfillment/strategies/worldmoveEsimOrderThenRedeem.js';

const sha1 = (value) => createHash('sha1')
  .update(value, 'utf8')
  .digest('hex')
  .toUpperCase();

const createClient = (calls) => createWorldmoveClient({
  merchantId: 'merchant-1',
  deptId: 'dept-1',
  token: 'token-1',
  apiUrl: 'https://worldmove.test',
  httpClient: {
    async post(...args) {
      calls.push(args);
      return {
        data: {
          code: 0,
          msg: null,
          orderId: 'wm-order-1',
        },
      };
    },
  },
});

test('Worldmove 2.1 normal eSIM order uses email and systemMail=false', async () => {
  const calls = [];
  const client = createClient(calls);

  await client.createEsimOrder({
    email: 'qa@example.com',
    wmproductId: 'WM-e-JP-SB-10GB-3D',
    quantity: 1,
    idempotencyKey: 'idem-1',
  });

  assert.equal(
    calls[0][0],
    'https://worldmove.test/Api/SOrder/mybuyesim',
  );

  assert.deepEqual(calls[0][1], {
    merchantId: 'merchant-1',
    deptId: 'dept-1',
    email: 'qa@example.com',
    prodList: [{
      wmproductId: 'WM-e-JP-SB-10GB-3D',
      qty: 1,
    }],
    systemMail: false,
    encStr: sha1(
      'merchant-1dept-1qa@example.comWM-e-JP-SB-10GB-3D1token-1',
    ),
  });
});

test('Worldmove 2.4 order-and-redeem uses qrcodeType', async () => {
  const calls = [];
  const client = createClient(calls);

  await client.createEsimOrderAndRedeem({
    wmproductId: 'WM_000003',
    quantity: 1,
    qrcodeType: 2,
    idempotencyKey: 'idem-2',
  });

  assert.equal(
    calls[0][0],
    'https://worldmove.test/Api/SOrder/mybuyesimRedemption',
  );

  assert.deepEqual(calls[0][1], {
    merchantId: 'merchant-1',
    deptId: 'dept-1',
    qrcodeType: 2,
    prodList: [{
      wmproductId: 'WM_000003',
      qty: 1,
    }],
    encStr: sha1(
      'merchant-1dept-12WM_0000031token-1',
    ),
  });

  assert.equal('email' in calls[0][1], false);
  assert.equal('systemMail' in calls[0][1], false);
});

test('normal eSIM strategy starts with Worldmove 2.1', async () => {
  const calls = [];
  const strategy = createWorldmoveEsimOrderThenRedeemStrategy();

  const response = await strategy.execute({
    order: {
      orderId: 'hico-order-1',
      email: 'qa@example.com',
    },
    item: {
      variantId: 'variant-1',
      wmproductId: 'WM-e-JP-SB-10GB-3D',
      quantity: 1,
    },
    itemId: 'item-1',
    record: {},
    providerClient: {
      async createEsimOrder(input) {
        calls.push(input);
        return {
          code: 0,
          orderId: 'wm-order-1',
        };
      },
    },
  });

  assert.equal(response.state, 'PENDING_CALLBACK');
  assert.equal(response.providerReference, 'wm-order-1');
  assert.equal(calls[0].email, 'qa@example.com');
  assert.equal(
    calls[0].wmproductId,
    'WM-e-JP-SB-10GB-3D',
  );
});

test('Worldmove 2.2 callback triggers 3.1 redeem with qrcodeType=2', async () => {
  const calls = [];
  const strategy = createWorldmoveEsimOrderThenRedeemStrategy();

  const response = await strategy.callback({
    item: {
      variantId: 'variant-1',
    },
    event: {
      providerOrderId: 'wm-order-1',
      itemList: [{
        iccid: 'coupon-1',
        redemptionCode: 'rcode-1',
      }],
    },
    providerClient: {
      async redeem(input) {
        calls.push(input);
        return {
          code: 0,
          msg: 'success',
        };
      },
    },
  });

  assert.equal(response.state, 'PENDING_CALLBACK');
  assert.equal(
    response.itemData.redemptionCode,
    'rcode-1',
  );
  assert.equal(calls[0].rcode, 'rcode-1');
  assert.equal(calls[0].qrcodeType, 2);
});
