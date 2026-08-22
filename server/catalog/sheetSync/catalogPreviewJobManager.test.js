import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createCatalogPreviewJobManager } from './catalogPreviewJobManager.js';
import { createSheetSyncRepository } from './sheetSyncRepository.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'catalogPreviewJobManager.testWorker.js');
const ignoreSigtermFixture = path.join(here, 'catalogPreviewJobManager.ignoreSigtermWorker.js');
const persistenceFixture = path.join(here, 'catalogPreviewJobManager.persistenceWorker.js');

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
  await waitFor(manager, failing.id, () => manager.inspectRuntime(failing.id).childExited);
  const slow = manager.start({ mode: 'quick' });
  const cancelled = manager.cancel(slow.id);
  assert.equal(cancelled.status, 'CANCELLED');
  await waitFor(manager, slow.id, () => manager.inspectRuntime(slow.id).childExited);
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

test('cancel and timeout escalate from SIGTERM to SIGKILL and wait for real process exit', async () => {
  const cancelledManager = createCatalogPreviewJobManager({ workerPath: ignoreSigtermFixture, deadlineMs: 2_000, terminateGraceMs: 50, terminalTtlMs: 10_000 });
  const cancelled = cancelledManager.start({ mode: 'quick' });
  assert.equal(cancelledManager.cancel(cancelled.id).status, 'CANCELLED');
  const cancelledExit = await waitFor(cancelledManager, cancelled.id, (job) => job.status === 'CANCELLED' && cancelledManager.inspectRuntime(cancelled.id).childExited);
  assert.equal(cancelledExit.status, 'CANCELLED');
  assert.equal(cancelledManager.inspectRuntime(cancelled.id).killTimerActive, false);
  await cancelledManager.shutdown();

  const timedManager = createCatalogPreviewJobManager({ workerPath: ignoreSigtermFixture, deadlineMs: 40, terminateGraceMs: 50, terminalTtlMs: 10_000 });
  const timed = timedManager.start({ mode: 'full' });
  const timedOut = await waitFor(timedManager, timed.id, (job) => job.status === 'TIMED_OUT');
  assert.equal(timedOut.errorCode, 'CATALOG_PREVIEW_TIMED_OUT');
  await waitFor(timedManager, timed.id, () => timedManager.inspectRuntime(timed.id).childExited);
  assert.equal(timedManager.inspectRuntime(timed.id).killTimerActive, false);
  await timedManager.shutdown();
});

test('worker-created batch and rows remain readable from the parent after worker exit', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-preview-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storageFile = path.join(directory, 'catalog_sheet_sync.json');
  const manager = createCatalogPreviewJobManager({
    workerPath: persistenceFixture,
    workerEnv: { CATALOG_PREVIEW_TEST_STORAGE_FILE: storageFile },
    deadlineMs: 1_000,
    terminalTtlMs: 10_000,
  });
  const started = manager.start({ mode: 'full', actor: { id: 'admin-1' } });
  const done = await waitFor(manager, started.id, (job) => job.status === 'SUCCEEDED');
  assert.equal(done.batchId, 'batch-worker-persisted');
  await waitFor(manager, started.id, () => manager.inspectRuntime(started.id).childExited);
  const repository = createSheetSyncRepository({ storageFile });
  assert.equal((await repository.getBatch(done.batchId)).status, 'READY_FOR_REVIEW');
  const page = await repository.listRowsPage(done.batchId, { page: 2, pageSize: 2 });
  assert.deepEqual(page.items.map((row) => row.id), ['row-worker-3']);
  assert.equal(page.total, 3);
  await manager.shutdown();
});

test('worker crash is terminal only after the child exits', async () => {
  const manager = createCatalogPreviewJobManager({ workerPath: fixture, deadlineMs: 1_000, terminalTtlMs: 10_000 });
  const failed = manager.start({ mode: 'legacy' });
  await waitFor(manager, failed.id, (job) => job.status === 'FAILED');
  await waitFor(manager, failed.id, () => manager.inspectRuntime(failed.id).childExited);
  assert.equal(manager.inspectRuntime(failed.id).killTimerActive, false);
  await manager.shutdown();
});
