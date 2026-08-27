import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSimHicoReference, auditEsimSheetRows, matchEsimProviderOffer, parseEsimSheetRows } from './esimSheetSource.js';

const headers = ['Loại SIM', 'WMID', 'Tên gói', 'Giá bán', 'Số ngày', 'Ngày chuyến đi', 'Ghi chú'];

test('eSIM Sheet parser is independent and keeps WMID and selling price semantics', () => {
  const parsed = parseEsimSheetRows({
    values: [headers, ['eSIM', ' WM-e-CN-500MB-1D ', 'China 1D', '180,000', '1', '1,3', 'Hỗ trợ eSIM']],
  });
  assert.equal(parsed.source, 'HICO_ESIM_SHEET');
  assert.equal(parsed.parserRevision, 2);
  assert.deepEqual(parsed.rows[0], {
    sourceRowNumber: 2,
    medium: 'esim',
    wmid: 'WM-E-CN-500MB-1D',
    productName: 'China 1D',
    sellingPrice: 180000,
    durationDays: 1,
    tripDayOptions: [1, 3],
    publicNote: 'Hỗ trợ eSIM',
    warnings: ['DATA_LIMIT_NOT_DECLARED'],
    errors: [],
  });
});

test('provider matching is exact, supports only Worldmove product type 0, and never guesses', () => {
  const offers = [
    { id: 'offer-1', provider: 'worldmove', wmproductId: 'wm-e-cn-500mb-1d', providerProductType: 0, leSIM: true, active: true },
    { id: 'offer-physical', provider: 'worldmove', wmproductId: 'WM-E-CN-500MB-2D', providerProductType: 1, active: true },
  ];
  assert.equal(matchEsimProviderOffer({ wmid: 'WM-E-CN-500MB-1D', providerOffers: offers }).status, 'MATCHED');
  assert.equal(matchEsimProviderOffer({ wmid: 'WM-E-CN-500MB-1', providerOffers: offers }).status, 'PROVIDER_NOT_FOUND');
  assert.equal(matchEsimProviderOffer({ wmid: 'WM-E-CN-500MB-2D', providerOffers: offers }).status, 'PROVIDER_PRODUCT_TYPE_UNSUPPORTED');
});

test('audit is read-only, aggregate-safe, and blocks unsupported provider types', () => {
  const result = auditEsimSheetRows({
    values: [headers, ['eSIM', 'WM-E-CN-500MB-1D', 'China 1D', 180000, 1, '', ''], ['eSIM', 'WM-E-CN-500MB-2D', 'China 2D', 250000, 2, '', '']],
    providerOffers: [
      { id: 'offer-1', provider: 'worldmove', wmproductId: 'WM-E-CN-500MB-1D', providerProductType: 0, leSIM: false, active: true },
      { id: 'offer-2', provider: 'worldmove', wmproductId: 'WM-E-CN-500MB-2D', providerProductType: 1, active: true },
    ],
  });
  assert.equal(result.rowsRead, 2);
  assert.equal(result.matchedRows, 1);
  assert.equal(result.blockedRows, 1);
  assert.equal(result.eligibleBeforeProvider, 2);
  assert.equal(result.structuralBlockedRows, 0);
  assert.equal(result.skippedNonEsimRows, 0);
  assert.equal(result.dataLimitNotDeclared, 2);
  assert.equal(result.rows[1].providerStatus, 'PROVIDER_PRODUCT_TYPE_UNSUPPORTED');
});

test('SimHICO maps the live eSIM columns instead of treating the title row as a header', () => {
  const liveHeaders = Array.from({ length: 25 }, () => '');
  Object.assign(liveHeaders, {
    0: 'Loại SIM',
    1: 'BẢNG GIÁ SIM DU LỊCH - HICO.VN',
    2: 'Ngày',
    3: 'Loại data',
    5: 'Giá eSim',
    10: 'APN',
    11: 'Quốc gia/ nhà mạng',
    12: 'Ghi chú',
    13: 'mốc thời gian reset',
    15: 'Được huỷ gói',
    17: 'SKU ESIM',
    23: 'wmid_sim',
    24: 'wmid_esim',
  });
  const row = Array.from({ length: 25 }, () => '');
  Object.assign(row, {
    0: 'eSIM',
    1: 'Mainland China, 1 Day, 500MB /day, 128kbps',
    2: '1',
    3: 'Chia ngày',
    5: '55,000',
    10: 'mobile',
    11: 'Trung Quốc : China Unicom, China Telecom',
    13: 'Reset dung lượng: 23:00 hàng ngày',
    15: 'Có thể',
    24: 'WM-e-CN-500MB-1D',
  });
  const parsed = parseEsimSheetRows({ values: [liveHeaders, row] });
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsed.rows[0], {
    sourceRowNumber: 2,
    medium: 'esim',
    wmid: 'WM-E-CN-500MB-1D',
    productName: 'Mainland China, 1 Day, 500MB /day, 128kbps',
    sellingPrice: 55000,
    durationDays: 1,
    tripDayOptions: [],
    publicNote: null,
    dataLimit: '500 MB',
    dataPolicy: 'daily',
    coverageLabel: 'Trung Quốc',
    networkLabel: 'China Unicom, China Telecom',
    apn: 'mobile',
    resetPolicy: 'Reset dung lượng: 23:00 hàng ngày',
    cancellable: 'Có thể',
    speedLabel: '128kbps',
    errors: [],
    warnings: [],
  });
});

test('SimHICO keeps total-package duration separate from trip-day selection', () => {
  const liveHeaders = Array.from({ length: 25 }, () => '');
  Object.assign(liveHeaders, { 0: 'Loại SIM', 1: 'BẢNG GIÁ SIM DU LỊCH - HICO.VN', 2: 'Ngày', 3: 'Loại data', 5: 'Giá eSim', 23: 'wmid_sim', 24: 'wmid_esim' });
  const row = Array.from({ length: 25 }, () => '');
  Object.assign(row, { 0: 'eSIM', 1: 'Mainland China, 5 Days, 3GB, 128kbps', 2: '5', 3: 'Gói tổng', 5: '80000', 24: 'WM-e-CN-T3-5D' });
  const parsed = parseEsimSheetRows({ values: [liveHeaders, row] });
  assert.equal(parsed.rows[0].durationDays, 5);
  assert.deepEqual(parsed.rows[0].tripDayOptions, [5]);
  assert.equal(parsed.rows[0].dataPolicy, 'total');
  assert.equal(parsed.rows[0].dataLimit, '3 GB');
});

test('eSIM source accepts only the SimHICO tab when a tab is declared', () => {
  assert.equal(assertSimHicoReference({ sheetTab: 'SimHICO' }).sheetTab, 'SimHICO');
  assert.throws(() => assertSimHicoReference({ sheetTab: 'HICO GỐC' }), (error) => error.code === 'ESIM_SHEET_TAB_INVALID' && error.status === 422);
});

test('SimHICO keeps total duration in the product name and blocks ambiguous data limits', () => {
  const liveHeaders = Array.from({ length: 25 }, () => '');
  Object.assign(liveHeaders, { 0: 'Loại SIM', 1: 'Tên gói', 2: 'Ngày', 3: 'Loại data', 5: 'Giá eSim', 23: 'wmid_sim', 24: 'wmid_esim' });
  const ambiguousData = Array.from({ length: 25 }, () => '');
  Object.assign(ambiguousData, { 0: 'eSIM', 1: 'China, 5 Days, 1GB, 2GB', 2: '5', 3: 'Gói tổng', 5: '80000', 24: 'WM-e-CN-AMBIGUOUS' });
  const ambiguousDuration = Array.from({ length: 25 }, () => '');
  Object.assign(ambiguousDuration, { 0: 'eSIM', 1: 'China, data 3GB', 2: '5', 3: 'Gói tổng', 5: '80000', 24: 'WM-e-CN-NO-DURATION' });
  const parsed = parseEsimSheetRows({ values: [liveHeaders, ambiguousData, ambiguousDuration] });
  assert.equal(parsed.rows[0].durationDays, 5);
  assert.ok(parsed.rows[0].errors.includes('DATA_LIMIT_AMBIGUOUS'));
  assert.equal(parsed.rows[1].durationDays, null);
  assert.ok(parsed.rows[1].errors.includes('TOTAL_DURATION_AMBIGUOUS'));
});

test('provider matching rejects another provider and inactive Worldmove offers', () => {
  const offers = [
    { id: 'offer-other', provider: 'other', wmproductId: 'WM-E-CN-500MB-1D', providerProductType: 0, leSIM: true, active: true },
    { id: 'offer-inactive', provider: 'worldmove', wmproductId: 'WM-E-CN-500MB-2D', providerProductType: 0, leSIM: true, active: false },
  ];
  assert.equal(matchEsimProviderOffer({ wmid: 'WM-E-CN-500MB-1D', providerOffers: offers }).status, 'PROVIDER_NOT_FOUND');
  assert.equal(matchEsimProviderOffer({ wmid: 'WM-E-CN-500MB-2D', providerOffers: offers }).status, 'PROVIDER_INACTIVE');
});

test('SimHICO treats unlimited labels as an explicit data limit and missing quota as a warning', () => {
  const sourceHeaders = ['WMID', 'Tên gói', 'Giá bán', 'Số ngày', 'Loại data'];
  const parsed = parseEsimSheetRows({
    values: [
      sourceHeaders,
      ['WM-UNLIMITED-DAY', 'China 1 Day, Unlimited data /day', 100000, 1, 'Chia ngày'],
      ['WM-UNLIMITED', 'Japan 5 Days, Unlimited', 100000, 5, 'Gói tổng'],
      ['WM-UNLIMITED-VI', 'Vietnam 3 ngày, Không giới hạn', 100000, 3, 'Gói tổng'],
      ['WM-MISSING', 'Korea 1 Day', 100000, 1, 'Chia ngày'],
    ],
  });
  assert.deepEqual(parsed.rows.slice(0, 3).map((row) => ({ dataLimit: row.dataLimit, errors: row.errors, warnings: row.warnings })), [
    { dataLimit: 'Unlimited', errors: [], warnings: [] },
    { dataLimit: 'Unlimited', errors: [], warnings: [] },
    { dataLimit: 'Unlimited', errors: [], warnings: [] },
  ]);
  assert.equal(parsed.rows[3].dataLimit, undefined);
  assert.deepEqual(parsed.rows[3].warnings, ['DATA_LIMIT_NOT_DECLARED']);
});

test('multiple explicit daily quotas remain a blocking data ambiguity', () => {
  const parsed = parseEsimSheetRows({
    values: [
      ['WMID', 'Tên gói', 'Giá bán', 'Số ngày', 'Loại data'],
      ['WM-AMBIGUOUS', 'China 1 Day, 500MB /day, 1GB /day', 100000, 1, 'Chia ngày'],
    ],
  });
  assert.ok(parsed.rows[0].errors.includes('DATA_LIMIT_AMBIGUOUS'));
  assert.deepEqual(parsed.rows[0].warnings, []);
});
