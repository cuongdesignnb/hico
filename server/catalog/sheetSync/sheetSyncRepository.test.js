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

test('postgres preview repository preserves physical and eSIM branches from one Sheet row', async () => {
  const inserts = [];
  const client = {
    async query(text, values) {
      if (text.startsWith('INSERT INTO catalog_sheet_sync_rows')) inserts.push({ text, values });
    },
    release() {},
  };
  const repository = createSheetSyncRepository({ pool: { async connect() { return client; } } });
  await repository.createBatch(batch('batch-multi-branch'), [
    { ...row('batch-multi-branch', 'row-physical'), rowHash: 'duplicate-invalid', status: 'INVALID', errors: [{ code: 'DUPLICATE_CONFLICT' }], normalizedData: { medium: 'physical_sim' } },
    { ...row('batch-multi-branch', 'row-esim'), rowHash: 'duplicate-invalid', status: 'INVALID', errors: [{ code: 'DUPLICATE_CONFLICT' }], normalizedData: { medium: 'esim' } },
  ]);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].values.length, 24);
  assert.deepEqual(inserts[0].values.filter((_, index) => index % 12 === 2), [2, 2]);
  assert.deepEqual(inserts[0].values.filter((_, index) => index % 12 === 3), ['duplicate-invalid', 'duplicate-invalid']);
  assert.deepEqual(inserts[0].values.filter((_, index) => index % 12 === 5), ['INVALID', 'INVALID']);
  assert.deepEqual(inserts[0].values.filter((_, index) => index % 12 === 6).map((value) => JSON.parse(value)), [{ medium: 'physical_sim' }, { medium: 'esim' }]);
  assert.deepEqual(inserts[0].values.filter((_, index) => index % 12 === 0), ['row-physical', 'row-esim']);
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

test('postgres preview storage fails fast when migration 020 constraints remain', async () => {
  const { assertPostgresSheetSyncStorage } = await import('./sheetSyncRepository.js');
  const queries = [];
  const pool = {
    async query(text) {
      queries.push(text);
      if (text.includes('to_regclass')) return { rows: [{ batches_table: 'catalog_sheet_sync_batches', rows_table: 'catalog_sheet_sync_rows' }] };
      return { rows: [{ conname: 'catalog_sheet_sync_rows_batch_id_sheet_row_number_key' }] };
    },
  };
  await assert.rejects(() => assertPostgresSheetSyncStorage({ pool }), (error) => error.code === 'INTEGRATION_STORAGE_INVALID'
    && error.message === 'Catalog preview storage schema is outdated.'
    && error.details.requiredMigration === '020_catalog_sheet_sync_multi_branch_rows.sql');
  assert.equal(queries.length, 2);
});

test('postgres preview storage accepts the migrated multi-branch schema', async () => {
  const { assertPostgresSheetSyncStorage } = await import('./sheetSyncRepository.js');
  let queryCount = 0;
  const pool = {
    async query(text) {
      queryCount += 1;
      if (text.includes('to_regclass')) return { rows: [{ batches_table: 'catalog_sheet_sync_batches', rows_table: 'catalog_sheet_sync_rows' }] };
      return { rows: [] };
    },
  };
  await assertPostgresSheetSyncStorage({ pool });
  assert.equal(queryCount, 2);
});

test('migration 020 drops legacy unique constraints without adding a unique replacement', async () => {
  const migration = await readFile(new URL('../../migrations/020_catalog_sheet_sync_multi_branch_rows.sql', import.meta.url), 'utf8');
  assert.match(migration, /DROP CONSTRAINT IF EXISTS catalog_sheet_sync_rows_batch_id_sheet_row_number_key/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS catalog_sheet_sync_rows_batch_id_row_hash_key/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS catalog_sheet_sync_rows_batch_row_hash_key/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS catalog_sheet_sync_rows_batch_sheet_row_idx/);
  assert.doesNotMatch(migration, /CREATE UNIQUE INDEX|UNIQUE\s*\(/i);
});
