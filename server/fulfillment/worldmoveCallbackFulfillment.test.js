import assert from 'node:assert/strict';
import test from 'node:test';
import { createFulfillmentService } from './fulfillmentService.js';
import { createWorldmoveRawCallbackSignature, parseWorldmoveRawCallback } from '../webhooks/worldmoveRawCallback.js';

const createFixture = ({ providerReference = 'WM-ORDER', redemptionCode = 'RC-FIXTURE' } = {}) => {
  let record = {
    id: 'ful-test',
    orderId: 'order-test',
    orderItemId: 'order-test:item-0',
    itemIndex: 0,
    fulfillmentMethod: 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
    state: 'PENDING_CALLBACK',
    providerReference,
    itemData: { redemptionCode },
  };
  let order = {
    orderId: 'order-test',
    status: 'PENDING_CALLBACK',
    items: [{
      variantId: 'variant-test',
      fulfillmentMethod: 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
      medium: 'esim',
      supplier: 'worldmove',
      providerProductType: 0,
      leSIM: false,
      operation: 'new_subscription',
    }],
  };
  let redeemCalls = 0;
  let sideEffectCalls = 0;
  const repository = {
    async findByProviderReference(reference) { return reference === providerReference ? [record] : []; },
    async findByRedemptionCode(code) { return code === redemptionCode ? [record] : []; },
    async update(id, updater) {
      if (id !== record.id) return null;
      record = typeof updater === 'function' ? await updater(record) : { ...record, ...updater };
      return record;
    },
  };
  const orderRepository = {
    async get(orderId) { return orderId === order.orderId ? order : null; },
    async update(orderId, updater) {
      order = typeof updater === 'function' ? await updater(order) : updater;
      return order;
    },
  };
  const eventRepository = {
    async get() { return null; },
    async save(event) { return event; },
  };
  const service = createFulfillmentService({
    repository,
    orderRepository,
    eventRepository,
    idempotencyRepository: { hash() { return 'request-hash'; } },
    providerClient: {
      async redeem() { redeemCalls += 1; },
    },
    sideEffectSink: async () => { sideEffectCalls += 1; },
  });
  return {
    service,
    getRecord: () => record,
    getRedeemCalls: () => redeemCalls,
    getSideEffectCalls: () => sideEffectCalls,
  };
};

const signed = (callbackType, payload) => ({
  ...payload,
  encStr: createWorldmoveRawCallbackSignature({
    callbackType,
    payload,
    merchantId: 'b000024',
    token: 'worldmove-test-token',
  }),
});

test('3.2 callback resolves fulfillment by redemption code', async () => {
  const fixture = createFixture({ providerReference: 'WM-ORDER-32', redemptionCode: 'RC-32' });
  const payload = signed('REDEEM_CALLBACK_3_2', {
    rcode: 'RC-32',
    qrcodeType: 2,
    qrcode: 'https://example.test/qr-32',
    qrcodeContent: 'LPA:1$example.test$RC-32',
    resultcode: '000',
  });
  const event = parseWorldmoveRawCallback({
    payload,
    rawBody: JSON.stringify(payload),
    merchantId: 'b000024',
    token: 'worldmove-test-token',
  });

  const result = await fixture.service.handleWebhookEvent(event);

  assert.equal(result.status, 'PROVISIONED');
  assert.equal(fixture.getRecord().state, 'PROVISIONED');
  assert.equal(fixture.getRecord().itemData.qrcode, 'https://example.test/qr-32');
  assert.equal(fixture.getRedeemCalls(), 0);
  assert.equal(fixture.getSideEffectCalls(), 1);
});

test('provider callback failure moves fulfillment to FAILED without redeem or side effects', async () => {
  const fixture = createFixture({ providerReference: 'WM-FAIL', redemptionCode: 'RC-FAIL' });
  const payload = signed('ORDER_CALLBACK_2_2', {
    orderId: 'WM-FAIL',
    orderSN: 'SN-FAIL',
    orderTime: '2026-08-28 12:00:00',
    code: 400,
    msg: 'failed',
    itemList: [{ iccid: '89852001', productName: 'eSIM', redemptionCode: 'RC-FAIL' }],
  });
  const event = parseWorldmoveRawCallback({
    payload,
    rawBody: JSON.stringify(payload),
    merchantId: 'b000024',
    token: 'worldmove-test-token',
  });

  await fixture.service.handleWebhookEvent(event);

  assert.equal(fixture.getRecord().state, 'FAILED');
  assert.equal(fixture.getRedeemCalls(), 0);
  assert.equal(fixture.getSideEffectCalls(), 0);
});
