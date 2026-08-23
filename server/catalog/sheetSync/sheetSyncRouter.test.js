import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogPreviewJobManager } from './catalogPreviewJobManager.js';
import { createSheetSyncRouter } from './sheetSyncRouter.js';

const workerFixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'catalogPreviewJobManager.testWorker.js');

const createServer = async (activeJob = null) => {
  const starts = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { user: { id: 'admin-1', email: 'admin@example.test' }, permissionUsed: 'catalog.sheet.sync.preview' };
    next();
  });
  const previewJobManager = {
    start: ({ mode, actor }) => { starts.push({ mode, actor }); return { id: `job-${starts.length}`, mode, status: 'RUNNING', stage: 'STARTING' }; },
    get: (id) => ({ id, mode: 'quick', status: 'RUNNING', stage: 'PARSING' }),
    cancel: (id) => ({ id, mode: 'quick', status: 'CANCELLED', stage: 'PARSING' }),
    active: () => activeJob,
  };
  const sheetSyncService = {
    getBatch: async () => ({ id: 'batch-1', status: 'READY_FOR_REVIEW' }),
    listRows: async (_id, options) => ({ items: [{ id: 'row-1', sheetRowNumber: 3 }], ...options, total: 201 }),
  };
  app.use('/api', createSheetSyncRouter({ previewJobManager, sheetSyncService, resyncService: {} }));
  const server = app.listen(0);
  await once(server, 'listening');
  return { server, starts, baseUrl: `http://127.0.0.1:${server.address().port}` };
};

test('legacy preview route returns 202 and does not invoke synchronous service preview', async () => {
  const { server, starts, baseUrl } = await createServer();
  try {
    const response = await fetch(`${baseUrl}/api/admin/catalog-sheet-sync/full-preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 202);
    assert.equal((await response.json()).job.id, 'job-1');
    assert.equal(starts[0].mode, 'full');
    assert.equal(starts[0].actor.id, 'admin-1');
  } finally { server.close(); await once(server, 'close'); }
});

test('row endpoint enforces bounded pagination and returns no unbounded array contract', async () => {
  const { server, baseUrl } = await createServer();
  try {
    const response = await fetch(`${baseUrl}/api/admin/catalog-sheet-sync/batch-1/rows?page=3&pageSize=999`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.page, 3);
    assert.equal(body.pageSize, 200);
    assert.equal(body.total, 201);
    assert.equal(body.items.length, 1);
  } finally { server.close(); await once(server, 'close'); }
});

test('active preview route exposes the reconnectable running job', async () => {
  const { server, baseUrl } = await createServer({ id: 'job-active', mode: 'full', status: 'RUNNING', stage: 'BUILDING_CANDIDATE' });
  try {
    const response = await fetch(`${baseUrl}/api/admin/catalog-sheet-sync/preview-jobs/active`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).job, { id: 'job-active', mode: 'full', status: 'RUNNING', stage: 'BUILDING_CANDIDATE' });
  } finally { server.close(); await once(server, 'close'); }
});

test('health handler remains responsive while a CPU-heavy preview worker is running', async () => {
  const manager = createCatalogPreviewJobManager({ workerPath: workerFixture, deadlineMs: 2_000, terminalTtlMs: 10_000 });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.auth = { user: { id: 'admin-1' } }; next(); });
  app.get('/api/health/catalog', (_req, res) => res.json({ status: 'healthy' }));
  app.use('/api', createSheetSyncRouter({ previewJobManager: manager, sheetSyncService: {}, resyncService: {} }));
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const started = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/catalog-sheet-sync/full-preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(started.status, 202);
    const health = await fetch(`http://127.0.0.1:${server.address().port}/api/health/catalog`);
    assert.equal(health.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 350));
  } finally {
    await manager.shutdown();
    server.close(); await once(server, 'close');
  }
});
