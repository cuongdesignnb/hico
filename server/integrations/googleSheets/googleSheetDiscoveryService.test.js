import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleSheetDiscoveryService, parseA1, quoteSheetTitle } from './googleSheetDiscoveryService.js';

const metadata = {
  spreadsheetId: 'sheet-id-123456',
  properties: { title: 'HICO QA', locale: 'vi_VN', timeZone: 'Asia/Ho_Chi_Minh' },
  sheets: [
    { properties: { sheetId: 42, title: 'HICO_SYNC', index: 0, sheetType: 'GRID', gridProperties: { rowCount: 5000, columnCount: 12, frozenRowCount: 1, frozenColumnCount: 0 } } },
    { properties: { sheetId: 99, title: 'Chart', index: 1, sheetType: 'OBJECT', gridProperties: {} } },
  ],
};

test('discovery sanitizes metadata and only exposes GRID sheets', async () => {
  const calls = [];
  const service = createGoogleSheetDiscoveryService({
    clientFactory: { getSpreadsheet: async (input) => { calls.push(['metadata', input]); return metadata; }, getValues: async () => [['variant_id', 'product_slug', 'sku', 'retail_price', 'currency', 'wmproduct_id', 'apn', 'network_label', 'public_note']] },
    resolveCredential: async () => ({ type: 'service_account' }),
  });
  const result = await service.getSpreadsheetMetadata({ spreadsheetId: 'sheet-id-123456' });
  assert.equal(result.title, 'HICO QA');
  assert.equal(result.sheets.length, 1);
  assert.equal(result.sheets[0].title, 'HICO_SYNC');
  assert.equal(JSON.stringify(result).includes('private_key'), false);
  assert.equal(calls[0][0], 'metadata');
});

test('header discovery validates contract and quotes tab names', async () => {
  const service = createGoogleSheetDiscoveryService({
    clientFactory: { getSpreadsheet: async () => metadata, getValues: async ({ range }) => { assert.match(range, /'HICO_SYNC'!A1:I20/); return [['variant_id', 'product_slug', 'sku', 'retail_price', 'currency', 'wmproduct_id', 'apn', 'network_label', 'public_note']]; } },
    resolveCredential: async () => ({ type: 'service_account' }),
  });
  const result = await service.readHeader({ spreadsheetId: 'sheet-id-123456', sheetId: 42, headerRow: 1, maxColumns: 9 });
  assert.equal(result.suggestedRange, 'A1:I5000');
  assert.equal(result.headerSampleRange, 'A1:I1');
  assert.equal(result.suggestedFullRange, 'A1:I5000');
  assert.equal(result.headers[0], 'variant_id');
  assert.equal(quoteSheetTitle("O'Reilly"), "'O''Reilly'");
});

test('range parser rejects unbounded or multi-range input', () => {
  assert.deepEqual(parseA1('A1:I5000'), { startColumn: 1, endColumn: 9, startRow: 1, endRow: 5000 });
  assert.deepEqual(parseA1('A1:Y17666'), { startColumn: 1, endColumn: 25, startRow: 1, endRow: 17666 });
  assert.throws(() => parseA1('A1:ZZZ5000'), (error) => error.code === 'GOOGLE_SHEET_RANGE_INVALID');
  assert.throws(() => parseA1('A1:I2,J1:J2'), (error) => error.code === 'GOOGLE_SHEET_RANGE_INVALID');
});

test('range validation accepts a logical range and returns bounded batches', () => {
  const service = createGoogleSheetDiscoveryService({ clientFactory: {}, resolveCredential: async () => ({}) });
  const mappedMetadata = { sheets: [{ title: 'HICO_SYNC', rowCount: 5000, columnCount: 12 }] };
  const result = service.validateRange({ metadata: mappedMetadata, sheetTitle: 'HICO_SYNC', range: 'A1:I5000', headerRow: 1 });
  assert.deepEqual(result.batching, { logicalRange: 'A1:I5000', batchCount: 1, maxRowsPerBatch: 5000, rowsFetched: 5000 });
  const long = service.validateRange({ metadata: { sheets: [{ ...mappedMetadata.sheets[0], rowCount: 17666 }] }, sheetTitle: 'HICO_SYNC', range: 'A1:I17666', headerRow: 1 });
  assert.equal(long.batching.batchCount, 4);
});

test('HICO GỐC header discovery suggests the full mapped column and physical row count', async () => {
  const hicoMetadata = {
    ...metadata,
    sheets: [{ properties: { sheetId: 7, title: 'HICO GỐC', index: 0, sheetType: 'GRID', gridProperties: { rowCount: 17666, columnCount: 46 } } }],
  };
  const service = createGoogleSheetDiscoveryService({
    clientFactory: { getSpreadsheet: async () => hicoMetadata, getValues: async () => [Array.from({ length: 25 }, (_, index) => `Header ${index + 1}`)] },
    resolveCredential: async () => ({ type: 'service_account' }),
  });
  const result = await service.readHeader({ spreadsheetId: 'sheet-id-123456', sheetId: 7, headerRow: 1, maxColumns: 25 });
  assert.equal(result.headerSampleRange, 'A1:Y1');
  assert.equal(result.suggestedFullRange, 'A1:Y17666');
});
