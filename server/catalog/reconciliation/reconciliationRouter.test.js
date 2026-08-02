import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { createReconciliationRouter } from './reconciliationRouter.js';
import {
  ReconciliationNotFoundError,
  ReconciliationRequestError,
} from './reconciliationService.js';

const withServer = async (service, callback) => {
  const app = express();
  app.use(express.json());
  app.use('/api', createReconciliationRouter({
    reconciliationService: service,
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

const serviceStub = (overrides = {}) => ({
  run: async () => ({
    created: 1,
    updated: 0,
    unchanged: 0,
    adminConfirmedPreserved: 0,
    summary: { total: 1, matched: 1 },
  }),
  getSummary: async () => ({ total: 1, matched: 1 }),
  listItems: async (query) => ({
    items: [{ variantId: 'variant-1', query }],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  }),
  updateItem: async (variantId, body) => ({ variantId, ...body }),
  ...overrides,
});

test('run API returns runtime reconciliation result', async () => {
  await withServer(serviceStub(), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/admin/catalog/reconciliation/run`,
      { method: 'POST' },
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).summary.matched, 1);
  });
});

test('summary and item filters are returned correctly', async () => {
  await withServer(serviceStub(), async (baseUrl) => {
    const summaryResponse = await fetch(
      `${baseUrl}/api/admin/catalog/reconciliation/summary`,
    );
    assert.deepEqual(await summaryResponse.json(), { total: 1, matched: 1 });

    const itemsResponse = await fetch(
      `${baseUrl}/api/admin/catalog/reconciliation/items?status=NOT_FOUND&search=Japan&page=2&pageSize=10`,
    );
    const payload = await itemsResponse.json();
    assert.equal(payload.items[0].query.status, 'NOT_FOUND');
    assert.equal(payload.items[0].query.search, 'Japan');
    assert.equal(payload.items[0].query.page, '2');
    assert.equal(payload.items[0].query.pageSize, '10');
  });
});

test('invalid resolution returns a consistent 400 error', async () => {
  await withServer(serviceStub({
    updateItem: async () => {
      throw new ReconciliationRequestError('Resolution không hợp lệ.');
    },
  }), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/admin/catalog/reconciliation/items/variant-1`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resolution: 'INVALID' }),
      },
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Resolution không hợp lệ.',
    });
  });
});

test('missing variant returns 404', async () => {
  await withServer(serviceStub({
    updateItem: async () => {
      throw new ReconciliationNotFoundError('Không tìm thấy reconciliation record.');
    },
  }), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/admin/catalog/reconciliation/items/missing`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resolution: 'MANUAL_PROCESSING' }),
      },
    );
    assert.equal(response.status, 404);
  });
});

test('internal API errors do not expose stack traces or secrets', async () => {
  await withServer(serviceStub({
    run: async () => {
      throw new Error('token=secret-value\nstack line');
    },
  }), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/admin/catalog/reconciliation/run`,
      { method: 'POST' },
    );
    const body = JSON.stringify(await response.json());
    assert.equal(response.status, 500);
    assert.equal(body.includes('secret-value'), false);
    assert.equal(body.includes('stack line'), false);
  });
});
