import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSheetSyncRepository, PREVIEW_ROW_INSERT_CHUNK_SIZE } from './sheetSyncRepository.js';

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

test('postgres preview repository persists 20k rows in bounded chunks inside one transaction', async () => {
  const queries = [];
  const client = {
    async query(text) { queries.push(text); },
    release() {},
  };
  const pool = { async connect() { return client; } };
  const repository = createSheetSyncRepository({ pool, logger: { error() {} } });
  const rows = Array.from({ length: 20_000 }, (_, index) => row('batch-large', `row-${index}`));
  await repository.createBatch(batch('batch-large'), rows);
  assert.equal(queries[0], 'BEGIN');
  assert.equal(queries.at(-1), 'COMMIT');
  assert.equal(queries.length - 2, Math.ceil(rows.length / PREVIEW_ROW_INSERT_CHUNK_SIZE) + 1);
  assert.equal(queries.filter((query) => query.startsWith('INSERT INTO catalog_sheet_sync_rows')).length, Math.ceil(rows.length / PREVIEW_ROW_INSERT_CHUNK_SIZE));
});

test('postgres preview repository rolls back the complete batch on a chunk failure', async () => {
  const queries = [];
  let rowInsertCount = 0;
  const client = {
    async query(text) {
      queries.push(text);
      if (text.startsWith('INSERT INTO catalog_sheet_sync_rows') && ++rowInsertCount === 2) {
        throw Object.assign(new Error('statement timeout'), { code: '57014', table: 'catalog_sheet_sync_rows' });
      }
    },
    release() {},
  };
  const repository = createSheetSyncRepository({ pool: { async connect() { return client; } }, logger: { error() {} } });
  await assert.rejects(() => repository.createBatch(batch('batch-timeout'), Array.from({ length: 500 }, (_, index) => row('batch-timeout', `row-${index}`))), (error) => error.code === 'CATALOG_PREVIEW_STORAGE_TIMEOUT');
  assert.equal(queries.at(-1), 'ROLLBACK');
  assert.equal(queries.includes('COMMIT'), false);
});
