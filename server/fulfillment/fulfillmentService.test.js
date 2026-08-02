import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
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
