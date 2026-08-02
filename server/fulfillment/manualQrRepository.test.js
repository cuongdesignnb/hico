import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteJson } from '../catalog/write/catalogWritePersistence.js';
import { createManualQrRepository } from './manualQrRepository.js';

test('manual QR reservation is variant-scoped, atomic, and idempotent', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-qr-'));
  const file = path.join(directory, 'manual_qrs.json');
  await atomicWriteJson(file, [
    { id: 'qr-1', variantId: 'v-1', qrcode: 'qr-a', assignedOrderId: null },
    { id: 'qr-orphan', variantId: 'missing', qrcode: 'qr-orphan', assignedOrderId: null },
  ]);
  const repository = createManualQrRepository({ filePath: file });
  const results = await Promise.allSettled([
    repository.reserve({ variantId: 'v-1', orderId: 'o-1', orderItemId: 'i-1' }),
    repository.reserve({ variantId: 'v-1', orderId: 'o-2', orderItemId: 'i-2' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const retry = await repository.reserve({ variantId: 'v-1', orderId: 'o-1', orderItemId: 'i-1' });
  assert.equal(retry.id, 'qr-1');
  assert.equal(JSON.parse(await readFile(file, 'utf8')).find((record) => record.id === 'qr-orphan').assignedOrderId, null);
});
