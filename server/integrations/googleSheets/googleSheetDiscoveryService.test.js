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
  assert.equal(result.headers[0], 'variant_id');
  assert.equal(quoteSheetTitle("O'Reilly"), "'O''Reilly'");
});

test('range parser rejects unbounded or multi-range input', () => {
  assert.deepEqual(parseA1('A1:I5000'), { startColumn: 1, endColumn: 9, startRow: 1, endRow: 5000 });
  assert.throws(() => parseA1('A1:ZZZ5000'), (error) => error.code === 'GOOGLE_SHEET_RANGE_INVALID');
  assert.throws(() => parseA1('A1:I2,J1:J2'), (error) => error.code === 'GOOGLE_SHEET_RANGE_INVALID');
});
