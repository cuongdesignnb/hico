import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteJson } from '../catalog/write/catalogWritePersistence.js';
import { createInventoryRepository } from './inventoryRepository.js';

test('physical stock reservation is idempotent and cannot double-decrement', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-stock-'));
  const inventoryFile = path.join(directory, 'inventory.json');
  const movementsFile = path.join(directory, 'inventory_movements.json');
  await atomicWriteJson(inventoryFile, [{ variantId: 'v-1', available: 1 }]);
  const repository = createInventoryRepository({ inventoryFile, movementsFile });
  const first = await repository.reserve({ variant: { id: 'v-1', sku: 'S-1' }, orderId: 'o-1', orderItemId: 'i-1', quantity: 1 });
  const retry = await repository.reserve({ variant: { id: 'v-1', sku: 'S-1' }, orderId: 'o-1', orderItemId: 'i-1', quantity: 1 });
  assert.equal(retry.id, first.id);
  await assert.rejects(repository.reserve({ variant: { id: 'v-1', sku: 'S-1' }, orderId: 'o-2', orderItemId: 'i-2', quantity: 1 }), (error) => error.code === 'PHYSICAL_STOCK_UNAVAILABLE');
});
