import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteJson } from '../catalog/write/catalogWritePersistence.js';
import { createFulfillmentRepository } from './fulfillmentRepository.js';
import { createFulfillmentIdempotencyRepository } from './fulfillmentIdempotencyRepository.js';
import { createManualQrRepository } from './manualQrRepository.js';
import { createInventoryRepository } from './inventoryRepository.js';
import { createFulfillmentService } from './fulfillmentService.js';

test('fulfillment service creates one manual QR assignment and preserves snapshot result', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-fulfillment-'));
  const qrFile = path.join(directory, 'manual_qrs.json');
  await atomicWriteJson(qrFile, [{ id: 'qr-1', variantId: 'v-1', qrcode: 'qr-value', assignedOrderId: null }]);
  const fulfillmentRepository = createFulfillmentRepository({ filePath: path.join(directory, 'fulfillments.json') });
  const idempotencyRepository = createFulfillmentIdempotencyRepository({ filePath: path.join(directory, 'fulfillment_idempotency.json') });
  const order = {
    orderId: 'o-1', email: 'a@example.com', status: 'PENDING_CALLBACK', items: [{ variantId: 'v-1', productName: 'Gói Nhật', medium: 'esim', supplier: 'hico', fulfillmentMethod: 'HICO_MANUAL_QR', quantity: 1 }],
  };
  const orderRepository = {
    current: order,
    async get() { return this.current; },
    async update(_id, update) { this.current = typeof update === 'function' ? await update(this.current) : update; return this.current; },
  };
  const service = createFulfillmentService({
    repository: fulfillmentRepository,
    idempotencyRepository,
    orderRepository,
    qrRepository: createManualQrRepository({ filePath: qrFile }),
    inventoryRepository: createInventoryRepository({ inventoryFile: path.join(directory, 'inventory.json'), movementsFile: path.join(directory, 'movements.json') }),
    providerClient: {},
  });
  const result = await service.createForOrder(order);
  assert.equal(result.orderStatus, 'PROVISIONED');
  assert.equal(result.records[0].state, 'PROVISIONED');
  assert.equal(orderRepository.current.items[0].qrcode, 'qr-value');
  const retry = await service.createForOrder(orderRepository.current);
  assert.equal(retry.records[0].id, result.records[0].id);
});

const createWorldmoveFixture = async (fulfillmentMethod) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-worldmove-'));
  const fulfillmentRepository = createFulfillmentRepository({ filePath: path.join(directory, 'fulfillments.json') });
  const idempotencyRepository = createFulfillmentIdempotencyRepository({ filePath: path.join(directory, 'fulfillment_idempotency.json') });
  const order = {
    orderId: `order-${fulfillmentMethod}`,
    email: 'customer@example.com',
    status: 'PENDING_CALLBACK',
    items: [{ variantId: 'v-1', productName: 'Gói Nhật', medium: 'esim', supplier: 'worldmove', fulfillmentMethod, providerProductType: 0, leSIM: fulfillmentMethod === 'WORLDMOVE_ESIM_REDEEM', quantity: 1, providerWmproductId: 'WM-1', wmproductId: 'WM-1' }],
  };
  const orderRepository = {
    current: order,
    async get() { return this.current; },
    async update(_id, update) { this.current = typeof update === 'function' ? await update(this.current) : update; return this.current; },
  };
  const providerCalls = [];
  const providerClient = {
    async createEsimOrder() { providerCalls.push('createEsimOrder'); return { orderId: 'WM-ORDER' }; },
    async createEsimOrderAndRedeem() { providerCalls.push('createEsimOrderAndRedeem'); return { orderId: 'WM-DIRECT' }; },
    async redeem(payload) { providerCalls.push({ redeem: payload }); return { code: 0 }; },
  };
  const service = createFulfillmentService({
    repository: fulfillmentRepository,
    idempotencyRepository,
    orderRepository,
    qrRepository: createManualQrRepository({ filePath: path.join(directory, 'manual_qrs.json') }),
    inventoryRepository: createInventoryRepository({ inventoryFile: path.join(directory, 'inventory.json'), movementsFile: path.join(directory, 'movements.json') }),
    providerClient,
  });
  return { directory, service, order, orderRepository, fulfillmentRepository, providerCalls };
};

test('leSIM=false correlates order callback redemption code to redeem callback and provisions once', async () => {
  const fixture = await createWorldmoveFixture('WORLDMOVE_ESIM_ORDER_THEN_REDEEM');
  try {
    await fixture.service.createForOrder(fixture.order);
    await fixture.service.handleWebhookEvent({
      eventId: 'evt-order-callback',
      callbackType: 'ESIM_ORDER_CALLBACK',
      eventType: 'ESIM_ORDER_CALLBACK',
      providerOrderId: 'WM-ORDER',
      orderId: 'WM-ORDER',
      code: 0,
      itemList: [{ redemptionCode: 'RC-1' }],
    });
    const pending = await fixture.fulfillmentRepository.findByOrderId(fixture.order.orderId);
    assert.equal(pending[0].state, 'PENDING_CALLBACK');
    assert.equal(pending[0].itemData.redemptionCode, 'RC-1');
    assert.equal(fixture.providerCalls.filter((call) => call.redeem).length, 1);

    await fixture.service.handleWebhookEvent({
      eventId: 'evt-redeem-callback',
      callbackType: 'REDEEM_CALLBACK',
      eventType: 'REDEEM_CALLBACK',
      providerOrderId: 'RC-1',
      rcode: 'RC-1',
      qrcode: 'qr-value',
      qrcodeType: 2,
      resultcode: '000',
      itemList: [],
    });
    const completed = await fixture.fulfillmentRepository.findByOrderId(fixture.order.orderId);
    assert.equal(completed[0].state, 'PROVISIONED');
    assert.equal(fixture.orderRepository.current.status, 'PROVISIONED');
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test('explicit eSIM provider failures become terminal fulfillment failures without redeeming again', async () => {
  const direct = await createWorldmoveFixture('WORLDMOVE_ESIM_REDEEM');
  const orderThenRedeem = await createWorldmoveFixture('WORLDMOVE_ESIM_ORDER_THEN_REDEEM');
  try {
    await direct.service.createForOrder(direct.order);
    await direct.service.handleWebhookEvent({
      eventId: 'evt-direct-failed',
      callbackType: 'ESIM_ORDER_REDEEM_CALLBACK',
      eventType: 'ESIM_ORDER_REDEEM_CALLBACK',
      providerOrderId: 'WM-DIRECT',
      orderId: 'WM-DIRECT',
      itemList: [{ rcode: 'RC-DIRECT', qrcode: 'qr-value', resultcode: '409', resultmsg: 'provider failure' }],
    });
    const directRecords = await direct.fulfillmentRepository.findByOrderId(direct.order.orderId);
    assert.equal(directRecords[0].state, 'FAILED');
    assert.equal(directRecords[0].failureCode, 'WORLDMOVE_RESULTCODE_409');

    await orderThenRedeem.service.createForOrder(orderThenRedeem.order);
    await orderThenRedeem.service.handleWebhookEvent({
      eventId: 'evt-order-failed',
      callbackType: 'ESIM_ORDER_CALLBACK',
      eventType: 'ESIM_ORDER_CALLBACK',
      providerOrderId: 'WM-ORDER',
      orderId: 'WM-ORDER',
      code: 409,
      msg: 'provider failure',
      itemList: [],
    });
    const orderRecords = await orderThenRedeem.fulfillmentRepository.findByOrderId(orderThenRedeem.order.orderId);
    assert.equal(orderRecords[0].state, 'FAILED');
    assert.equal(orderRecords[0].failureCode, 'WORLDMOVE_CODE_409');
    assert.equal(orderThenRedeem.providerCalls.filter((call) => call.redeem).length, 0);
  } finally {
    await rm(direct.directory, { recursive: true, force: true });
    await rm(orderThenRedeem.directory, { recursive: true, force: true });
  }
});
