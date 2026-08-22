import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createCatalogPreviewJobManager } from './catalogPreviewJobManager.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'catalogPreviewJobManager.testWorker.js');

const waitFor = async (manager, id, predicate, timeout = 2_000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const job = manager.get(id);
    if (predicate(job)) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${id}`);
};

test('preview manager starts one job and returns a summary without rows', async () => {
  const manager = createCatalogPreviewJobManager({ workerPath: fixture, deadlineMs: 1_000, terminalTtlMs: 10_000 });
  const started = manager.start({ mode: 'full', actor: { id: 'admin-1', email: 'admin@example.test' } });
  assert.equal(started.status, 'RUNNING');
  assert.throws(() => manager.start({ mode: 'quick' }), (error) => error.code === 'CATALOG_PREVIEW_IN_PROGRESS');
  const done = await waitFor(manager, started.id, (job) => job.status === 'SUCCEEDED');
  assert.equal(done.batchId, 'batch-test-1');
  assert.equal(done.batch.summary.products, 1);
  assert.equal('rows' in done, false);
  await manager.shutdown();
});

test('preview manager exposes failure and timeout/cancel terminal states', async (t) => {
  const manager = createCatalogPreviewJobManager({ workerPath: fixture, deadlineMs: 120, terminateGraceMs: 50, terminalTtlMs: 10_000 });
  const failing = manager.start({ mode: 'legacy' });
  const failed = await waitFor(manager, failing.id, (job) => job.status === 'FAILED');
  assert.equal(failed.errorCode, 'CATALOG_PREVIEW_FAILED');
  const slow = manager.start({ mode: 'quick' });
  const cancelled = manager.cancel(slow.id);
  assert.equal(cancelled.status, 'CANCELLED');
  const timed = manager.start({ mode: 'full' });
  const timedOut = await waitFor(manager, timed.id, (job) => job.status === 'TIMED_OUT');
  assert.equal(timedOut.errorCode, 'CATALOG_PREVIEW_TIMED_OUT');
  await manager.shutdown();
  t.diagnostic('manager terminal states verified');
});

test('child worker keeps the parent event loop responsive while CPU work runs', async () => {
  const manager = createCatalogPreviewJobManager({ workerPath: fixture, deadlineMs: 2_000, terminalTtlMs: 10_000 });
  const started = manager.start({ mode: 'full' });
  const timerStart = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(Date.now() - timerStart < 500);
  await waitFor(manager, started.id, (job) => job.status === 'SUCCEEDED');
  await manager.shutdown();
});
