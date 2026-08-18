import { parsePrice } from './sheetRowParser.js';
import { QUICK_SHEET_SYNC_FIELDS, SheetSyncError } from './sheetSyncTypes.js';
import { DEFAULT_HICO_GOC_FIELD_MAPPING, DEFAULT_HICO_GOC_PRICE_MAPPING, normalizeHicoGocMapping, normalizeHicoGocPriceMapping } from './hicoGocMapping.js';

const FORMULA_ERROR = /^#(?:REF!|VALUE!|NAME\?|N\/A|DIV\/0!|NUM!|NULL!)/i;
const MOJIBAKE = /(?:\u00c3\u0192.|\u00c3\u201a.|\u00c3\u00a1\u00c2\xbb|\u00c3\u00a2\u00e2\u201a\u00ac|[\u00c3\u00c2\u00e2\u00f0\ufffd])/;
const clean = (value, field, errors) => {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value).trim().normalize('NFC');
  if (FORMULA_ERROR.test(text)) errors.push({ code: 'FORMULA_ERROR', field });
  if (MOJIBAKE.test(text)) errors.push({ code: 'MOJIBAKE_DETECTED', field });
  return text || undefined;
};
const number = (value, field, errors) => {
  const text = clean(value, field, errors);
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 3650) errors.push({ code: 'DURATION_INVALID', field });
  return /^\d+$/.test(text) ? Number(text) : undefined;
};
const amount = (value) => String(value).replace(',', '.').replace(/\.0+$/, '');
const quota = (text, pattern) => {
  const match = String(text ?? '').match(pattern);
  return match ? `${amount(match[1])}${match[2].toUpperCase()}` : undefined;
};

export const parseDataLimit = (productName, dataPolicy) => {
  if (dataPolicy === 'daily') return quota(productName, /(\d+(?:[.,]\d+)?)\s*(KB|MB|GB)\s*\/\s*ngày/i);
  return quota(productName, /tổng\s*(\d+(?:[.,]\d+)?)\s*(KB|MB|GB)/i);
};

export const parseActualDuration = (productName, errors) => {
  const match = String(productName ?? '').match(/(\d+)\s*(?:ngày|day|days)\b/i);
  if (!match) errors.push({ code: 'DURATION_AMBIGUOUS', field: 'productName' });
  return match ? Number(match[1]) : undefined;
};

export const parseSpeedLabel = (productName, errors) => {
  const matches = [...String(productName ?? '').matchAll(/(\d+)\s*kbps\b/gi)];
  if (matches.length > 1) errors.push({ code: 'DATA_SPEED_AMBIGUOUS', field: 'speedLabel' });
  return matches.length === 1 ? `${matches[0][1]}kbps` : undefined;
};

const parsePolicy = (value, errors) => {
  const text = clean(value, 'dataPolicy', errors);
  if (text === undefined) { errors.push({ code: 'DATA_POLICY_INVALID', field: 'dataPolicy' }); return undefined; }
  if (text === 'Chia ngày') return 'daily';
  if (text === 'Gói tổng') return 'total';
  errors.push({ code: 'DATA_POLICY_INVALID', field: 'dataPolicy' });
  return undefined;
};
const parseCancellable = (value, errors) => {
  const text = clean(value, 'cancellable', errors);
  if (text === undefined) return undefined;
  if (text === 'Có thể') return true;
  if (text === 'Không thể') return false;
  errors.push({ code: 'CANCELLABLE_INVALID', field: 'cancellable' });
  return undefined;
};
const validateMediumEvidence = (value, medium, errors) => {
  const text = clean(value, 'simType', errors);
  if (!text) return;
  const normalized = text.toLowerCase();
  if (medium === 'physical_sim' && normalized === 'esim') errors.push({ code: 'MEDIUM_SOURCE_MISMATCH', field: 'simType' });
  if (medium === 'esim' && normalized === 'sim') errors.push({ code: 'MEDIUM_SOURCE_MISMATCH', field: 'simType' });
};
const valueAt = (cells, mapping, field) => cells[mapping[field]];
const optionalImage = (value, field, errors) => {
  const text = clean(value, field, errors);
  if (text === undefined) return undefined;
  if (!/^\/(?:images|uploads)\//.test(text) || text.includes('..')) {
    errors.push({ code: 'IMAGE_SOURCE_UNSUPPORTED', field });
    return undefined;
  }
  return text;
};
const optionalGallery = (value, field, errors) => {
  const text = clean(value, field, errors);
  if (text === undefined) return undefined;
  const values = text.split(/[\r\n,;]+/).map((item) => item.trim()).filter(Boolean);
  const images = values.map((item) => optionalImage(item, field, errors)).filter(Boolean);
  return images.length ? [...new Set(images)] : undefined;
};
const sourceFor = (cells, mapping, field, priceMapping, errors) => {
  const source = priceMapping[field];
  return parsePrice(valueAt(cells, mapping, source), errors, 'price');
};

const makeCandidate = ({ cells, rowNumber, medium, mapping, priceMapping }) => {
  const errors = [];
  validateMediumEvidence(valueAt(cells, mapping, 'simType'), medium, errors);
  const productName = clean(valueAt(cells, mapping, 'productName'), 'productName', errors);
  const dataPolicy = parsePolicy(valueAt(cells, mapping, 'dataType'), errors);
  const durationDays = dataPolicy === 'daily'
    ? number(valueAt(cells, mapping, 'durationDays'), 'durationDays', errors)
    : parseActualDuration(productName, errors);
  const dataLimit = parseDataLimit(productName, dataPolicy);
  if (!dataLimit) errors.push({ code: 'DATA_LIMIT_AMBIGUOUS', field: 'dataLimit' });
  const sku = clean(valueAt(cells, mapping, medium === 'physical_sim' ? 'skuPhysical' : 'skuEsim'), 'sku', errors);
  const wmproductId = clean(valueAt(cells, mapping, medium === 'physical_sim' ? 'wmproductIdPhysical' : 'wmproductIdEsim'), 'wmproductId', errors);
  const priceField = medium === 'physical_sim' ? 'physical' : 'esim';
  const compareField = medium === 'physical_sim' ? 'comparePhysical' : 'compareEsim';
  const price = sourceFor(cells, mapping, priceField, priceMapping, errors);
  const compareAtPrice = priceMapping[compareField]
    ? parsePrice(valueAt(cells, mapping, priceMapping[compareField]), errors, 'compareAtPrice')
    : undefined;
  if (compareAtPrice !== undefined && (price === undefined || compareAtPrice < price || compareAtPrice === price)) errors.push({ code: 'COMPARE_PRICE_INVALID', field: 'compareAtPrice' });
  const normalizedData = {
    sku,
    medium,
    productName,
    dataPolicy,
    dataLimit,
    duration: durationDays ? `${durationDays} ngày` : undefined,
    durationDays,
    ...(dataPolicy === 'total' ? { tripDayOptions: [number(valueAt(cells, mapping, 'durationDays'), 'tripDayOptions', errors)] } : {}),
    price,
    ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
    wmproductId,
    apn: clean(valueAt(cells, mapping, 'apn'), 'apn', errors),
    networkLabel: clean(valueAt(cells, mapping, 'networkLabel'), 'networkLabel', errors),
    publicNote: clean(valueAt(cells, mapping, 'publicNote'), 'publicNote', errors),
    activationPolicy: clean(valueAt(cells, mapping, 'activationPolicy'), 'activationPolicy', errors),
    speedLabel: parseSpeedLabel(productName, errors),
    cancellable: parseCancellable(valueAt(cells, mapping, 'cancellable'), errors),
    ...(mapping.imageUrl !== null && mapping.imageUrl !== undefined ? { imageUrl: optionalImage(valueAt(cells, mapping, 'imageUrl'), 'imageUrl', errors) } : {}),
    ...(mapping.galleryImageUrls !== null && mapping.galleryImageUrls !== undefined ? { galleryImageUrls: optionalGallery(valueAt(cells, mapping, 'galleryImageUrls'), 'galleryImageUrls', errors) } : {}),
    ...(mapping.description !== null && mapping.description !== undefined ? { description: clean(valueAt(cells, mapping, 'description'), 'description', errors) } : {}),
    ...(mapping.installationGuide !== null && mapping.installationGuide !== undefined ? { installationGuide: clean(valueAt(cells, mapping, 'installationGuide'), 'installationGuide', errors) } : {}),
  };
  if (!sku) errors.push({ code: 'EXACT_MATCH_REQUIRED', field: 'sku' });
  if (!wmproductId) errors.push({ code: 'PROVIDER_NOT_FOUND', field: 'wmproductId' });
  if (normalizedData.tripDayOptions?.some((value) => value === undefined)) delete normalizedData.tripDayOptions;
  const hasFields = QUICK_SHEET_SYNC_FIELDS.some((field) => normalizedData[field] !== undefined);
  if (!hasFields) errors.push({ code: 'NO_MUTABLE_FIELDS' });
  return {
    id: `hico-goc-${rowNumber}-${medium}`,
    sheetRowNumber: rowNumber,
    sourceRow: rowNumber,
    sourceMedium: medium,
    sourceSku: sku,
    normalizedData,
    rowHash: JSON.stringify([rowNumber, medium, normalizedData]),
    errors,
    diff: {},
    appliedFields: [],
    status: errors.length ? 'INVALID' : 'VALID',
    mode: 'quick',
  };
};

export const parseHicoGocRowsWithDiagnostics = (values = [], { fieldMapping = DEFAULT_HICO_GOC_FIELD_MAPPING, priceMapping = DEFAULT_HICO_GOC_PRICE_MAPPING, headerRow = 1 } = {}) => {
  if (!Array.isArray(values) || values.length < 1 || !Array.isArray(values[0])) throw new SheetSyncError('HICO GỐC does not contain a header row.', { code: 'SHEET_HEADER_REQUIRED', status: 422 });
  if (!Number.isInteger(headerRow) || headerRow < 1) throw new SheetSyncError('HICO GỐC header row is invalid.', { code: 'SHEET_HEADER_INVALID', status: 422 });
  const mapping = normalizeHicoGocMapping(fieldMapping);
  const prices = normalizeHicoGocPriceMapping(priceMapping);
  const rows = [];
  const rejectionReasons = new Map();
  let rowsRead = 0;
  let rowsParsed = 0;
  let rowsRejected = 0;
  const addReason = (code) => rejectionReasons.set(code, (rejectionReasons.get(code) ?? 0) + 1);
  values.slice(1).forEach((cells, offset) => {
    if (!Array.isArray(cells) || !cells.some((value) => String(value ?? '').trim() !== '')) return;
    rowsRead += 1;
    let emitted = false;
    const rowNumber = headerRow + offset + 1;
    for (const medium of ['physical_sim', 'esim']) {
      const skuField = medium === 'physical_sim' ? 'skuPhysical' : 'skuEsim';
      if (clean(valueAt(cells, mapping, skuField), 'sku', []) === undefined) continue;
      emitted = true;
      const candidate = makeCandidate({ cells, rowNumber, medium, mapping, priceMapping: prices });
      rows.push(candidate);
      rowsParsed += 1;
      if (candidate.errors.length) {
        rowsRejected += 1;
        candidate.errors.forEach((error) => addReason(error.code));
      }
    }
    if (!emitted) { rowsRejected += 1; addReason('MISSING_SKU'); }
  });
  return {
    rows,
    diagnostics: {
      rowsRead,
      rowsParsed,
      rowsRejected,
      rejectionReasons: Object.fromEntries([...rejectionReasons.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))),
    },
  };
};

export const parseHicoGocRows = (values = [], options = {}) => parseHicoGocRowsWithDiagnostics(values, options).rows;

const logicalKey = (row) => {
  const data = row.normalizedData;
  return JSON.stringify([
    data.sku, data.medium, data.productName, data.dataPolicy,
    data.dataLimit, data.duration,
  ]);
};
const payloadKey = (row) => JSON.stringify([
  row.normalizedData.sku,
  row.normalizedData.medium,
  row.normalizedData.price,
  row.normalizedData.compareAtPrice ?? null,
  row.normalizedData.wmproductId,
  row.normalizedData.apn ?? null,
  row.normalizedData.networkLabel ?? null,
  row.normalizedData.activationPolicy ?? null,
  row.normalizedData.speedLabel ?? null,
  row.normalizedData.cancellable ?? null,
]);

export const collapseHicoGocRows = (rows = []) => {
  const groups = new Map();
  for (const row of rows) {
    if (row.normalizedData.dataPolicy !== 'total') {
      groups.set(`${row.id}:daily`, [row]);
      continue;
    }
    const key = logicalKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const collapsed = [];
  for (const group of groups.values()) {
    if (group.length === 1 || group[0].normalizedData.dataPolicy !== 'total') {
      collapsed.push(...group);
      continue;
    }
    const payloads = new Set(group.map(payloadKey));
    if (payloads.size > 1) {
      collapsed.push(...group.map((row) => ({ ...row, status: 'INVALID', errors: [...row.errors, { code: 'DUPLICATE_CONFLICT' }] })));
      continue;
    }
    const first = group[0];
    const options = [...new Set(group.flatMap((row) => row.normalizedData.tripDayOptions ?? []))].sort((a, b) => a - b);
    collapsed.push({
      ...first,
      normalizedData: { ...first.normalizedData, tripDayOptions: options, sourceRows: group.map((row) => row.sheetRowNumber) },
      sourceRows: group.map((row) => row.sheetRowNumber),
      rowHash: JSON.stringify({ ...first.normalizedData, tripDayOptions: options }),
    });
  }
  return collapsed;
};
