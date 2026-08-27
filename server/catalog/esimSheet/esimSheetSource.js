import { createHash } from 'node:crypto';

export const ESIM_SHEET_SOURCE = 'HICO_ESIM_SHEET';
export const ESIM_SHEET_PARSER_REVISION = 1;
export const SIM_HICO_SHEET_TAB = 'SimHICO';
export const SIM_HICO_ESIM_COLUMN_CONTRACT = Object.freeze({
  medium: 0,
  productName: 1,
  durationDays: 2,
  dataPolicy: 3,
  sellingPrice: 5,
  apn: 10,
  coverageLabel: 11,
  publicNote: 12,
  activationPolicy: 13,
  cancellable: 15,
  sku: 17,
  wmid: 24,
});

const HEADER_ALIASES = Object.freeze({
  medium: ['medium', 'loại sim', 'loai sim', 'sim type'],
  wmid: ['wmid', 'wm id', 'wmid esim', 'wm id esim', 'wmproductid', 'wm product id', 'worldmove id'],
  productName: ['product name', 'tên gói', 'ten goi', 'name'],
  sellingPrice: ['selling price', 'giá bán', 'gia ban', 'price'],
  durationDays: ['duration days', 'số ngày', 'so ngay', 'days'],
  tripDayOptions: ['trip day options', 'ngày chuyến đi', 'ngay chuyen di', 'trip days'],
  publicNote: ['public note', 'ghi chú', 'ghi chu', 'note'],
  familyKey: ['family key', 'package family', 'họ gói', 'ho goi', 'family'],
  dataLimit: ['data limit', 'dung lượng', 'dung luong', 'data'],
  dataPolicy: ['data policy', 'loại data', 'loai data', 'data type'],
  coverageId: ['coverage id', 'destination id', 'mã coverage', 'ma coverage'],
  coverageLabel: ['coverage', 'destination', 'quốc gia', 'quoc gia'],
  coverageType: ['coverage type', 'loại coverage', 'loai coverage'],
  speedLabel: ['speed', 'tốc độ', 'toc do'],
  networkLabel: ['network', 'nhà mạng', 'nha mang', 'carrier'],
  apn: ['apn'],
  activationPolicy: ['activation policy', 'kích hoạt', 'kich hoat'],
  cancellable: ['cancellable', 'được huỷ', 'duoc huy', 'cancelable'],
});

const normalizeHeader = (value) => String(value ?? '')
  .normalize('NFC')
  .trim()
  .toLocaleLowerCase('vi-VN')
  .replace(/[._-]+/g, ' ')
  .replace(/\s+/g, ' ');

const normalizeWmid = (value) => String(value ?? '').normalize('NFC').trim().toUpperCase();

export const assertSimHicoReference = (reference) => {
  const sheetTab = String(reference?.sheetTab ?? '').normalize('NFC').trim();
  if (sheetTab && sheetTab !== SIM_HICO_SHEET_TAB) {
    throw Object.assign(new Error(`eSIM source phải đọc tab ${SIM_HICO_SHEET_TAB}.`), { code: 'ESIM_SHEET_TAB_INVALID', status: 422 });
  }
  return reference;
};

const nonEmpty = (value) => {
  const normalized = String(value ?? '').normalize('NFC').trim();
  return normalized || null;
};

const normalizeMedium = (value) => {
  const normalized = nonEmpty(value)?.toLocaleLowerCase('vi-VN');
  if (normalized === 'esim' || normalized === 'e-sim') return 'esim';
  if (normalized === 'sim' || normalized === 'sim vật lý' || normalized === 'sim vat ly') return 'physical_sim';
  return nonEmpty(value);
};

const normalizeDataPolicy = (value) => {
  const normalized = nonEmpty(value)?.toLocaleLowerCase('vi-VN');
  if (normalized === 'chia ngày' || normalized === 'chia ngay' || normalized === 'daily') return 'daily';
  if (normalized === 'gói tổng' || normalized === 'goi tong' || normalized === 'total') return 'total';
  return nonEmpty(value);
};

const labelsFromProductName = (value, dataPolicy) => {
  const name = nonEmpty(value) ?? '';
  const matches = [...name.matchAll(/(\d+(?:[.,]\d+)?)\s*(KB|MB|GB|TB)\b/gi)]
    .map((match) => `${match[1].replace(',', '.')} ${match[2].toUpperCase()}`);
  const dataLimit = dataPolicy === 'total'
    ? (name.match(/(?:tổng|total)[^\d]*(\d+(?:[.,]\d+)?)\s*(KB|MB|GB|TB)\b/i)?.slice(1).join(' ') ?? matches.at(-1))
    : matches[0];
  const speed = name.match(/(\d+)\s*kbps\b/i)?.[1];
  return {
    ...(dataLimit ? { dataLimit } : {}),
    ...(speed ? { speedLabel: `${speed}kbps` } : {}),
  };
};

const splitCoverageLabel = (value) => {
  const text = nonEmpty(value);
  if (!text) return { coverageLabel: null, networkLabel: null };
  const separator = text.indexOf(':');
  if (separator < 0) return { coverageLabel: null, networkLabel: text };
  return {
    coverageLabel: nonEmpty(text.slice(0, separator)),
    networkLabel: nonEmpty(text.slice(separator + 1)),
  };
};

const numberFrom = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value ?? '').replace(/[.,\s]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const listOfPositiveIntegers = (value) => [...new Set(
  String(value ?? '')
    .split(/[,;|]/)
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0),
)].sort((left, right) => left - right);

const durationFromProductName = (value) => {
  const match = nonEmpty(value)?.match(/(?:^|[,\s])(\d+)\s*(?:day|days|ngày)\b/i);
  const days = Number.parseInt(match?.[1] ?? '', 10);
  return Number.isInteger(days) && days > 0 ? days : null;
};

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const simHicoIndexes = (headers) => {
  const normalized = headers.map(normalizeHeader);
  const isSimHico = normalized[23] === 'wmid sim' && normalized[24] === 'wmid esim';
  return isSimHico ? {
    medium: 0,
    productName: 1,
    durationDays: 2,
    dataPolicy: 3,
    sellingPrice: 5,
    apn: 10,
    networkLabel: 11,
    publicNote: 12,
    activationPolicy: 13,
    cancellable: 15,
    wmid: 24,
  } : {};
};

const indexesFor = (headers, mapping = {}) => {
  const normalized = headers.map(normalizeHeader);
  const profile = simHicoIndexes(headers);
  return Object.fromEntries(Object.entries(HEADER_ALIASES).map(([field, aliases]) => {
    const explicit = mapping[field];
    if (Number.isInteger(explicit) && explicit >= 0) return [field, explicit];
    if (Number.isInteger(profile[field])) return [field, profile[field]];
    const index = normalized.findIndex((header) => aliases.includes(header));
    return [field, index];
  }));
};

export const parseEsimSheetRows = ({ values = [], mapping = {} } = {}) => {
  if (!Array.isArray(values) || values.length === 0) {
    return { headers: [], rows: [], errors: [{ code: 'ESIM_SHEET_EMPTY' }], headerHash: digest([]), source: ESIM_SHEET_SOURCE, parserRevision: ESIM_SHEET_PARSER_REVISION };
  }
  const headers = Array.isArray(values[0]) ? values[0].map((value) => String(value ?? '').normalize('NFC').trim()) : [];
  const indexes = indexesFor(headers, mapping);
  const errors = [];
  if (indexes.wmid < 0) errors.push({ code: 'ESIM_WMID_COLUMN_REQUIRED' });
  if (indexes.sellingPrice < 0) errors.push({ code: 'ESIM_SELLING_PRICE_COLUMN_REQUIRED' });
  const rows = values.slice(1).map((cells, index) => {
    const valueAt = (field) => Array.isArray(cells) ? cells[indexes[field]] : undefined;
    const wmid = normalizeWmid(valueAt('wmid'));
    const sellingPrice = numberFrom(valueAt('sellingPrice'));
    const rowErrors = [];
    if (!wmid) rowErrors.push('WMID_REQUIRED');
    if (!sellingPrice || sellingPrice <= 0) rowErrors.push('SELLING_PRICE_INVALID');
    const normalizedPolicy = normalizeDataPolicy(valueAt('dataPolicy'));
    const inferredLabels = labelsFromProductName(valueAt('productName'), normalizedPolicy);
    const coverage = splitCoverageLabel(valueAt('coverageLabel') ?? valueAt('networkLabel'));
    const sourceDays = numberFrom(valueAt('durationDays'));
    const durationDays = normalizedPolicy === 'total'
      ? (durationFromProductName(valueAt('productName')) ?? sourceDays)
      : sourceDays;
    const tripDayOptions = normalizedPolicy === 'total'
      ? listOfPositiveIntegers(sourceDays)
      : listOfPositiveIntegers(valueAt('tripDayOptions'));
    const optional = {
      familyKey: nonEmpty(valueAt('familyKey')),
      dataLimit: nonEmpty(valueAt('dataLimit')) ?? inferredLabels.dataLimit,
      dataPolicy: normalizedPolicy,
      coverageId: nonEmpty(valueAt('coverageId')),
      coverageType: nonEmpty(valueAt('coverageType')),
      coverageLabel: coverage.coverageLabel,
      speedLabel: nonEmpty(valueAt('speedLabel')) ?? inferredLabels.speedLabel,
      networkLabel: coverage.networkLabel,
      apn: nonEmpty(valueAt('apn')),
      activationPolicy: nonEmpty(valueAt('activationPolicy')),
      cancellable: nonEmpty(valueAt('cancellable')),
    };
    const medium = normalizeMedium(valueAt('medium'));
    return {
      sourceRowNumber: index + 2,
      ...(medium ? { medium } : {}),
      wmid,
      productName: nonEmpty(valueAt('productName')),
      sellingPrice,
      durationDays,
      tripDayOptions,
      publicNote: nonEmpty(valueAt('publicNote')),
      ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value != null)),
      errors: rowErrors,
    };
  }).filter((row) => row.wmid || row.productName || row.sellingPrice !== null);
  return {
    headers,
    rows,
    errors,
    headerHash: digest(headers),
    source: ESIM_SHEET_SOURCE,
    parserRevision: ESIM_SHEET_PARSER_REVISION,
  };
};

export const matchEsimProviderOffer = ({ wmid, providerOffers = [] } = {}) => {
  const normalized = normalizeWmid(wmid);
  if (!normalized) return { status: 'PROVIDER_NOT_FOUND', offer: null, candidates: [] };
  const candidates = providerOffers.filter((offer) => (
    offer?.active !== false
    && normalizeWmid(offer.wmproductId) === normalized
  ));
  const supported = candidates.filter((offer) => offer.providerProductType === 0 && typeof offer.leSIM === 'boolean');
  if (supported.length === 1) return { status: 'MATCHED', offer: supported[0], candidates: supported };
  if (supported.length > 1) return { status: 'PROVIDER_AMBIGUOUS', offer: null, candidates: supported };
  if (candidates.length > 0) return { status: 'PROVIDER_PRODUCT_TYPE_UNSUPPORTED', offer: null, candidates };
  return { status: 'PROVIDER_NOT_FOUND', offer: null, candidates: [] };
};

export const auditEsimSheetRows = ({ values = [], mapping = {}, providerOffers = [] } = {}) => {
  const parsed = parseEsimSheetRows({ values, mapping });
  const rows = parsed.rows.map((row) => {
    const provider = matchEsimProviderOffer({ wmid: row.wmid, providerOffers });
    return {
      sourceRowNumber: row.sourceRowNumber,
      wmid: row.wmid,
      sellingPrice: row.sellingPrice,
      providerStatus: provider.status,
      providerOfferId: provider.offer?.id ?? null,
      providerProductType: provider.offer?.providerProductType ?? null,
      leSIM: provider.offer?.leSIM ?? null,
      errors: [...row.errors, ...(provider.status === 'MATCHED' ? [] : [provider.status])],
    };
  });
  return {
    source: ESIM_SHEET_SOURCE,
    parserRevision: ESIM_SHEET_PARSER_REVISION,
    headerHash: parsed.headerHash,
    rowsRead: rows.length,
    matchedRows: rows.filter((row) => row.providerStatus === 'MATCHED').length,
    blockedRows: rows.filter((row) => row.providerStatus !== 'MATCHED' || row.errors.length > 0).length,
    rows,
  };
};

export { normalizeWmid };
