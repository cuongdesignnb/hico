import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSheetSyncRepository } from './sheetSyncRepository.js';

const batch = (id) => ({
  id,
  mode: 'quick',
  sourceHash: `source-${id}`,
  spreadsheetId: 'sheet-test',
  sheetTab: 'HICO GỐC',
  sheetRange: 'A1:X2',
  status: 'READY_FOR_REVIEW',
  createdAt: new Date().toISOString(),
  summary: { total: 1, valid: 1, invalid: 0 },
});

const row = (batchId, id) => ({
  id,
  batchId,
  sheetRowNumber: 2,
  rowHash: `row-${id}`,
  status: 'VALID',
  normalizedData: { productName: 'Test product' },
  raw: {},
  diff: {},
  errors: [],
  appliedFields: [],
  createdAt: new Date().toISOString(),
});

test('file preview repository serializes concurrent writes without losing batches', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-sheet-repository-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storageFile = path.join(directory, 'catalog_sheet_sync.json');
  const first = createSheetSyncRepository({ storageFile });
  const second = createSheetSyncRepository({ storageFile });
  await Promise.all([
    first.createBatch(batch('batch-a'), [row('batch-a', 'row-a')]),
    second.createBatch(batch('batch-b'), [row('batch-b', 'row-b')]),
  ]);
  const reader = createSheetSyncRepository({ storageFile });
  assert.deepEqual((await reader.listBatches()).map((item) => item.id).sort(), ['batch-a', 'batch-b']);
  assert.equal((await reader.listRowsPage('batch-b', { page: 1, pageSize: 1 })).items[0].id, 'row-b');
});

test('file preview repository rejects corrupt storage instead of overwriting it', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-sheet-repository-invalid-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storageFile = path.join(directory, 'catalog_sheet_sync.json');
  await writeFile(storageFile, '{"batches":[]}\n', 'utf8');
  const repository = createSheetSyncRepository({ storageFile });
  await assert.rejects(() => repository.getBatch('missing'), (error) => error.code === 'INTEGRATION_STORAGE_INVALID');
  assert.equal(await readFile(storageFile, 'utf8'), '{"batches":[]}\n');
});
