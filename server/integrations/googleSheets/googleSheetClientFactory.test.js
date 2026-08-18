import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleSheetClientFactory } from './googleSheetClientFactory.js';
import { parseA1Range } from './googleSheetRangeBatches.js';

const settings = (overrides = {}) => ({
  spreadsheetId: 'sheet-test',
  sheetName: 'HICO GỐC',
  sheetRange: 'A1:B10001',
  headerRow: 1,
  maxRowsPerBatch: 5000,
  ...overrides,
});

const testCredential = { type: 'service_account', client_email: 'test@example.test', project_id: 'test', private_key: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----' };

test('readRows merges sequential batches and keeps one header', async () => {
  const client = createGoogleSheetClientFactory();
  const calls = [];
  client.getValues = async ({ range }) => {
    const a1 = range.split('!').at(-1);
    const parsed = parseA1Range(a1);
    calls.push(a1);
    return Array.from({ length: parsed.endRow - parsed.startRow + 1 }, (_, offset) => {
      const rowNumber = parsed.startRow + offset;
      return [rowNumber === 1 ? 'header' : `row-${rowNumber}`];
    });
  };
  const reference = await client.readRows({ credential: testCredential, settings: settings() });
  assert.deepEqual(calls, ['A1:B5000', 'A5001:B10000', 'A10001:B10001']);
  assert.equal(reference.values.length, 10001);
  assert.equal(reference.values.filter((row) => row[0] === 'header').length, 1);
  assert.equal(reference.values.at(-1)[0], 'row-10001');
  assert.deepEqual(reference.batching, { logicalRange: 'A1:B10001', batchCount: 3, maxRowsPerBatch: 5000, rowsFetched: 10001 });
});

test('readRows preserves real header offset for header rows after row one', async () => {
  const client = createGoogleSheetClientFactory();
  client.getValues = async ({ range }) => {
    const parsed = parseA1Range(range.split('!').at(-1));
    return Array.from({ length: parsed.endRow - parsed.startRow + 1 }, (_, offset) => {
      const rowNumber = parsed.startRow + offset;
      return [rowNumber === 3 ? 'header' : `row-${rowNumber}`];
    });
  };
  const reference = await client.readRows({ credential: testCredential, settings: settings({ sheetRange: 'A1:B10001', headerRow: 3 }) });
  assert.equal(reference.values[0][0], 'header');
  assert.equal(reference.values.length, 9999);
});

test('readRows pads omitted trailing empty rows so later batch rows keep their Sheet number', async () => {
  const client = createGoogleSheetClientFactory();
  client.getValues = async ({ range }) => {
    const parsed = parseA1Range(range.split('!').at(-1));
    if (parsed.startRow === 1) return [['header']];
    if (parsed.startRow === 5001) return [['row-5001']];
    return [['row-10001']];
  };
  const reference = await client.readRows({ credential: testCredential, settings: settings() });
  assert.equal(reference.values.length, 10001);
  assert.equal(reference.values[5000][0], 'row-5001');
  assert.equal(reference.values[9999][0], undefined);
  assert.equal(reference.values[10000][0], 'row-10001');
});

test('readRows fails closed with safe batch details', async () => {
  const client = createGoogleSheetClientFactory();
  let calls = 0;
  client.getValues = async () => {
    calls += 1;
    if (calls === 2) throw new Error('provider response contains secret-like text');
    return [['header']];
  };
  await assert.rejects(
    () => client.readRows({ credential: testCredential, settings: settings() }),
    (error) => error.code === 'SHEET_BATCH_FETCH_FAILED'
      && error.details.batchIndex === 2
      && error.details.batchCount === 3
      && error.details.range === 'A5001:B10000'
      && !String(error.message).includes('secret-like'),
  );
  assert.equal(calls, 2);
});

test('testConnection fetches only the bounded sample range', async () => {
  const client = createGoogleSheetClientFactory();
  const calls = [];
  client.getSpreadsheet = async () => ({ properties: { title: 'Test' }, sheets: [{ properties: { title: 'HICO GỐC' } }] });
  client.getValues = async ({ range }) => { calls.push(range); return [['header'], ['row']]; };
  const result = await client.testConnection({ credential: testCredential, settings: settings({ sheetRange: 'A1:Y17666' }) });
  assert.equal(result.rowsSampled, 1);
  assert.deepEqual(calls, ["sheet-test!'HICO GỐC'!A1:Y20"]);
});
