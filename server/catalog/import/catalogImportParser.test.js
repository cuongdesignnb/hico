import assert from 'node:assert/strict';
import test from 'node:test';
import { mapCatalogImportRows, parseCatalogImportText } from './catalogImportParser.js';

test('parses pasted tabular data with quoted values and semantic header mapping', () => {
  const parsed = parseCatalogImportText('Họ gói\tWMID\tDung lượng\tThời hạn\tGiá bán\n"China, daily"\tWM-e-CN-500MB-1D\t500MB/ngày\t1 ngày\t70,000');
  const rows = mapCatalogImportRows({
    parsed,
    columnMap: {
      family: 'Họ gói',
      sku: 'WMID',
      dataLimit: 'Dung lượng',
      duration: 'Thời hạn',
      price: 'Giá bán',
    },
  });
  assert.equal(rows[0].family, 'China, daily');
  assert.equal(rows[0].sku, 'WM-e-CN-500MB-1D');
  assert.equal(rows[0].price, '70000');
});

test('rejects duplicate headers and missing semantic mappings', () => {
  assert.throws(() => parseCatalogImportText('SKU\tSKU\nA\tB'), (error) => error.code === 'IMPORT_HEADER_DUPLICATE');
  const parsed = parseCatalogImportText('Family\tSKU\nChina\tWM-e-CN-500MB-1D');
  assert.throws(() => mapCatalogImportRows({ parsed, columnMap: { family: 'Family', sku: 'SKU' } }), (error) => error.code === 'IMPORT_COLUMN_MAP_REQUIRED');
});
