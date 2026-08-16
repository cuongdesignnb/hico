import assert from 'node:assert/strict';
import test from 'node:test';
import { collapseHicoGocRows, parseDataLimit, parseHicoGocRows } from './hicoGocParser.js';
import { publicRow } from './sheetSyncTypes.js';
import { createInMemorySheetSyncRepository } from './sheetSyncRepository.js';
import { createSheetSyncService } from './sheetSyncService.js';

const cells = (overrides = {}) => {
  const row = Array(25).fill('');
  row[1] = 'Trung Quốc, 500MB /Ngày (hết 500MB dùng không giới hạn 128kbps)';
  row[2] = '10'; row[3] = 'Chia ngày'; row[4] = '70.000'; row[5] = '80.000';
  row[10] = 'internet'; row[11] = 'China Unicom'; row[13] = 'Reset hàng ngày'; row[15] = 'Có thể';
  row[16] = 'SKU-SIM-10'; row[17] = 'SKU-ESIM-10'; row[23] = 'WM-SIM-10'; row[24] = 'WM-ESIM-10';
  for (const [index, value] of Object.entries(overrides)) row[Number(index)] = value;
  return row;
};

test('HICO GỐC parser maps daily data and keeps exact identities private in public rows', () => {
  const [physical] = parseHicoGocRows([Array(25).fill('header'), cells()]);
  assert.equal(physical.normalizedData.dataPolicy, 'daily');
  assert.equal(physical.normalizedData.dataLimit, '500MB');
  assert.equal(physical.normalizedData.duration, '10 ngày');
  assert.equal(physical.normalizedData.speedLabel, '128kbps');
  assert.equal(physical.normalizedData.price, 70000);
  assert.equal(publicRow(physical).normalizedData.sku, undefined);
  assert.equal(publicRow(physical).normalizedData.wmproductId, undefined);
});

test('HICO GỐC parser maps total package duration and collapses trip-day options', () => {
  const first = cells({ 1: 'Trung Quốc, 5 Ngày, Tổng 3GB', 2: '1', 3: 'Gói tổng', 16: 'SKU-TOTAL', 17: '', 23: 'WM-TOTAL' });
  const second = [...first]; second[2] = '3';
  const rows = collapseHicoGocRows(parseHicoGocRows([Array(25).fill('header'), first, second]));
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].normalizedData.tripDayOptions, [1, 3]);
  assert.equal(rows[0].normalizedData.duration, '5 ngày');
  assert.equal(rows[0].normalizedData.dataLimit, '3GB');
  assert.equal(rows[0].sourceRows.length, 2);
});

test('HICO GỐC parser blocks ambiguous quota and invalid cancellable values', () => {
  assert.equal(parseDataLimit('5 ngày, Tổng 3GB', 'total'), '3GB');
  const [row] = parseHicoGocRows([Array(25).fill('header'), cells({ 1: 'Trung Quốc, gói data', 15: 'Có' })]);
  assert.ok(row.errors.some((error) => error.code === 'DATA_LIMIT_AMBIGUOUS'));
  assert.ok(row.errors.some((error) => error.code === 'CANCELLABLE_INVALID'));
});

test('HICO GỐC duplicate payload conflict is never collapsed', () => {
  const first = cells({ 1: 'Trung Quốc, 5 Ngày, Tổng 3GB', 2: '1', 3: 'Gói tổng', 16: 'SKU-TOTAL', 17: '', 23: 'WM-TOTAL' });
  const second = [...first]; second[2] = '3'; second[10] = 'different-apn';
  const rows = collapseHicoGocRows(parseHicoGocRows([Array(25).fill('header'), first, second]));
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.errors.some((error) => error.code === 'DUPLICATE_CONFLICT')));
});

test('quick preview matches exact SKU and blocks stale Sheet before apply', async () => {
  const row = cells({ 1: 'Trung Quốc, 500MB /Ngày', 16: 'SKU-1', 17: '', 23: 'WM-1' });
  const reference = { spreadsheetId: 'sheet-id', sheetTab: 'HICO GỐC', sheetRange: 'A1:Y2', values: [Array(25).fill('header'), row], syncSettings: {} };
  const product = { id: 'product-1', name: 'Old name', slug: 'cn', status: 'active', operation: 'new_subscription' };
  const variant = { id: 'variant-1', productId: 'product-1', sku: 'SKU-1', price: 60000, currency: 'VND', medium: 'physical_sim', supplier: 'worldmove', fulfillmentMethod: 'WORLDMOVE_PHYSICAL_ORDER', providerOfferId: 'offer-1', wmproductId: 'WM-1' };
  const offer = { id: 'offer-1', provider: 'worldmove', wmproductId: 'WM-1', providerProductType: 1, active: true };
  const repository = createInMemorySheetSyncRepository();
  let applyCalled = false;
  const service = createSheetSyncService({
    repository,
    referenceClient: { readRows: async () => reference },
    canonicalRepository: { readCatalog: async () => ({ products: [product], variants: [variant], manifest: { versionId: 'catalog-v1' } }) },
    providerRepository: { listOffers: async () => [offer] },
    fulfillmentProfileRepository: { listActive: async () => [] },
    applyService: { apply: async ({ batch }) => { applyCalled = batch.mode === 'quick'; return { versionId: 'catalog-v2', applied: {} }; } },
    logger: { info() {} },
  });
  const preview = await service.preview({ mode: 'quick' });
  assert.equal(preview.batch.mode, 'quick');
  assert.equal(preview.rows[0].status, 'VALID');
  assert.equal(preview.rows[0].normalizedData.sku, undefined);
  reference.values = [reference.values[0], [...row].map((value, index) => index === 4 ? '71000' : value)];
  await assert.rejects(() => service.apply(preview.batch.id, { selection: { rowIds: [preview.rows[0].id] } }), (error) => error.code === 'SHEET_SYNC_STALE_PREVIEW');
  assert.equal(applyCalled, false);
});
