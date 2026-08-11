import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePrice, parseSheetRows } from './sheetRowParser.js';
import { matchSheetVariant } from './sheetVariantMatcher.js';
import { validateSimHicoHeader } from './simHicoHeaderAliases.js';

const headers = ['Ngày', 'Loại data', 'SKU SVL', 'SKU ESIM', 'Giá\nSim', 'Giá eSim', 'wmid_sim', 'wmid_esim', 'APN', 'Quốc gia/ nhà mạng', 'Ghi chú'];

test('Sim HICO aliases normalize newline, Unicode and slash spacing', () => {
  const result = validateSimHicoHeader(headers);
  assert.equal(result.valid, true);
  assert.equal(result.hasEsim, true);
  assert.equal(result.hasPhysical, true);
  assert.equal(result.detectedAliases['Giá\nSim'], 'pricePhysical');
  assert.equal(result.detectedAliases['Quốc gia/ nhà mạng'], 'networkLabel');
});

test('native Sim HICO dual row creates independent eSIM and physical candidates', () => {
  const [physical, esim] = parseSheetRows([headers, ['1', 'Chia ngày', 'SIM-1', 'Esim0481', '50000', '55000', 'WM-SIM-1', 'WM-e-CN-500MB-1D', 'mobile', 'China Unicom', 'note']]);
  assert.equal(physical.sourceMedium, 'physical_sim');
  assert.equal(physical.sourceSku, 'SIM-1');
  assert.equal(physical.normalizedData.price, 50000);
  assert.equal(esim.sourceMedium, 'esim');
  assert.equal(esim.sourceSku, 'Esim0481');
  assert.equal(esim.normalizedData.price, 55000);
  assert.equal(esim.normalizedData.wmproductId, 'WM-e-CN-500MB-1D');
});

test('native parser supports single medium, blank rows and locale-safe prices', () => {
  const [row] = parseSheetRows([headers, ['', '', '', 'Esim0482', '', '60.000', '', 'WM-e-2', 'mobile', 'China', '']]);
  assert.equal(row.sourceMedium, 'esim');
  assert.equal(row.normalizedData.price, 60000);
  assert.equal(parseSheetRows([headers, ['', '', '', '', '', '', '', '', '', '', '']]).length, 0);
  assert.equal(parsePrice('55,000', [], 'price'), 55000);
  const errors = [];
  assert.equal(parsePrice('55k', errors, 'price'), undefined);
  assert.equal(errors[0].code, 'PRICE_INVALID');
});

test('native matcher uses SKU and medium, never WMID', () => {
  const products = [{ id: 'product-1', slug: 'catalog', status: 'active' }];
  const variants = [
    { id: 'esim-1', productId: 'product-1', sku: 'Esim0481', medium: 'esim' },
    { id: 'physical-1', productId: 'product-1', sku: 'Esim0481', medium: 'physical_sim' },
  ];
  const esim = matchSheetVariant({ row: { normalizedData: { sku: ' esim0481 ', medium: 'esim', wmproductId: 'wrong' } }, products, variants });
  assert.equal(esim.variant.id, 'esim-1');
  assert.equal(matchSheetVariant({ row: { normalizedData: { sku: 'missing', medium: 'esim' } }, products, variants }).error.code, 'UNMATCHED_VARIANT');
  assert.equal(matchSheetVariant({ row: { normalizedData: { sku: 'Esim0481' } }, products, variants }).error.code, 'AMBIGUOUS_VARIANT');
});
