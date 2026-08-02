import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createCatalogWriteRouter } from './catalogWriteRouter.js';
import { CatalogWriteError } from './catalogWriteValidation.js';

const startServer = async (t, service) => {
  const app = express();
  app.use(express.json());
  app.use('/api', createCatalogWriteRouter({
    catalogWriteService: service,
  }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
};

test('write router returns command status and idempotency replay header', async (t) => {
  const baseUrl = await startServer(t, {
    createProduct: async () => ({
      status: 201,
      replayed: true,
      body: {
        product: { id: 'product-1', status: 'draft' },
        catalogVersionId: 'catalog-2',
      },
    }),
  });
  const response = await fetch(`${baseUrl}/api/admin/catalog/products`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-actor-id': 'admin-1',
    },
    body: JSON.stringify({ idempotencyKey: 'key' }),
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('x-idempotent-replay'), 'true');
  assert.equal((await response.json()).product.status, 'draft');
});

test('write router preserves controlled error contract', async (t) => {
  const baseUrl = await startServer(t, {
    updateProduct: async () => {
      throw new CatalogWriteError(
        'Dữ liệu đã được cập nhật bởi người dùng khác. Vui lòng tải lại.',
        { status: 409, code: 'ENTITY_VERSION_CONFLICT' },
      );
    },
  });
  const response = await fetch(
    `${baseUrl}/api/admin/catalog/products/product-1`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    },
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: 'Dữ liệu đã được cập nhật bởi người dùng khác. Vui lòng tải lại.',
    code: 'ENTITY_VERSION_CONFLICT',
  });
});

test('unexpected API failures expose neither stack nor filesystem path', async (t) => {
  const originalError = console.error;
  console.error = () => undefined;
  t.after(() => {
    console.error = originalError;
  });
  const baseUrl = await startServer(t, {
    getProduct: async () => {
      const error = new Error('secret at D:\\private\\catalog.json');
      error.stack = 'STACK_SECRET';
      throw error;
    },
  });
  const response = await fetch(
    `${baseUrl}/api/admin/catalog/products/product-1`,
  );
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.code, 'INTERNAL_ERROR');
  assert.equal(JSON.stringify(body).includes('STACK_SECRET'), false);
  assert.equal(JSON.stringify(body).includes('D:\\private'), false);
});

