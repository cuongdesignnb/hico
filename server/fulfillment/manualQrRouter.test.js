import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createManualQrRepository } from './manualQrRepository.js';
import { createManualQrRouter } from './manualQrRouter.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('manual QR admin API stores images outside public uploads and never lists secret paths', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-private-qr-'));
  const repository = createManualQrRepository({
    filePath: path.join(directory, 'manual_qrs.json'),
    legacyFilePath: null,
    imageDirectory: path.join(directory, 'images'),
  });
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', createManualQrRouter({ qrRepository: repository }));
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const createdResponse = await fetch(`${baseUrl}/api/admin/manual-qrs/upload`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId: 'variant-1', base64Data: png }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(created.hasImage, true);
    assert.equal(created.storageKey, undefined);
    assert.equal(created.qrcode, undefined);
    const stored = JSON.parse(await readFile(path.join(directory, 'manual_qrs.json'), 'utf8'))[0];
    assert.equal(typeof stored.storageKey, 'string');
    assert.equal(stored.qrcode, undefined);

    const listResponse = await fetch(`${baseUrl}/api/admin/manual-qrs`);
    assert.deepEqual((await listResponse.json())[0], { ...created, assignedOrderId: null, assignedOrderItemId: null, assignedAt: null });
    const imageResponse = await fetch(`${baseUrl}/api/admin/manual-qrs/${created.id}/image`);
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get('cache-control'), 'private, no-store');
    assert.equal(imageResponse.headers.get('content-type').startsWith('image/png'), true);
  } finally {
    server.close();
    await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
});
