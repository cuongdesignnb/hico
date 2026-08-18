import { createHash } from 'node:crypto';
import { SheetSyncError } from './sheetSyncTypes.js';

export const HICO_GOC_SHEET = 'HICO GỐC';
export const HICO_GOC_MAX_COLUMN = 46;

// HICO GỐC is a stable business sheet. These indexes are zero-based and are
// deliberately kept separate from presentation/formula tabs.
export const DEFAULT_HICO_GOC_FIELD_MAPPING = Object.freeze({
  simType: 0,
  productName: 1,
  durationDays: 2,
  dataType: 3,
  pricePhysical: 4,
  priceEsim: 5,
  priceWholesalePhysical: 6,
  priceWholesaleEsim: 7,
  priceCtvPhysical: 8,
  priceCtvEsim: 9,
  apn: 10,
  networkLabel: 11,
  publicNote: 12,
  activationPolicy: 13,
  availability: 14,
  cancellable: 15,
  skuPhysical: 16,
  skuEsim: 17,
  wmproductIdPhysical: 23,
  wmproductIdEsim: 24,
});

export const OPTIONAL_HICO_GOC_FIELD_MAPPING = Object.freeze([
  'imageUrl',
  'galleryImageUrls',
  'description',
  'installationGuide',
]);

export const PRICE_SOURCES = Object.freeze({
  physical: Object.freeze(['pricePhysical', 'priceWholesalePhysical', 'priceCtvPhysical']),
  esim: Object.freeze(['priceEsim', 'priceWholesaleEsim', 'priceCtvEsim']),
});

export const DEFAULT_HICO_GOC_PRICE_MAPPING = Object.freeze({
  physical: 'pricePhysical',
  esim: 'priceEsim',
  comparePhysical: null,
  compareEsim: null,
});

const index = (value, fallback) => {
  const candidate = value === undefined || value === null ? fallback : Number(value);
  return Number.isInteger(candidate) && candidate >= 0 && candidate < HICO_GOC_MAX_COLUMN
    ? candidate
    : null;
};

const optionalIndex = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return index(value, null);
};

const validPriceSource = (medium, value, allowEmpty = false) => {
  if (allowEmpty && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || !PRICE_SOURCES[medium].includes(value)) return null;
  return value;
};

export const normalizeHicoGocMapping = (mapping = {}) => {
  const source = mapping && typeof mapping === 'object' ? mapping : {};
  const normalized = {};
  for (const [field, fallback] of Object.entries(DEFAULT_HICO_GOC_FIELD_MAPPING)) {
    normalized[field] = index(source[field], fallback);
  }
  if (Object.values(normalized).some((value) => value === null)) {
    throw new SheetSyncError('HICO GỐC field mapping is invalid.', { code: 'SHEET_FIELD_MAPPING_INVALID', status: 422 });
  }
  for (const field of OPTIONAL_HICO_GOC_FIELD_MAPPING) normalized[field] = optionalIndex(source[field]);
  return normalized;
};

export const normalizeHicoGocPriceMapping = (mapping = {}) => {
  const source = mapping && typeof mapping === 'object' ? mapping : {};
  const normalized = {
    physical: validPriceSource('physical', source.physical) ?? DEFAULT_HICO_GOC_PRICE_MAPPING.physical,
    esim: validPriceSource('esim', source.esim) ?? DEFAULT_HICO_GOC_PRICE_MAPPING.esim,
    comparePhysical: validPriceSource('physical', source.comparePhysical, true),
    compareEsim: validPriceSource('esim', source.compareEsim, true),
  };
  if (normalized.physical === normalized.comparePhysical || normalized.esim === normalized.compareEsim) {
    throw new SheetSyncError('Compare price source must differ from selling price source.', { code: 'SHEET_PRICE_MAPPING_INVALID', status: 422 });
  }
  return normalized;
};

export const hicoGocHeaderHash = (headers = []) => {
  const normalized = headers.map((header) => String(header ?? '').trim().normalize('NFC'));
  while (normalized.at(-1) === '') normalized.pop();
  return createHash('sha256').update(JSON.stringify(normalized), 'utf8').digest('hex');
};

export const hicoGocColumnName = (index) => {
  let result = '';
  for (let value = Number(index) + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
};

const columnIndex = (value) => String(value).toUpperCase().split('').reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;

export const parseHicoGocRange = (range) => {
  const match = /^([A-Z]{1,3})\d+:([A-Z]{1,3})\d+$/i.exec(String(range ?? '').trim());
  if (!match) throw new SheetSyncError('Google Sheet range is invalid.', { code: 'GOOGLE_SHEET_RANGE_INVALID', status: 422 });
  const startColumn = columnIndex(match[1]);
  const endColumn = columnIndex(match[2]);
  if (startColumn < 0 || endColumn < startColumn || endColumn >= HICO_GOC_MAX_COLUMN) {
    throw new SheetSyncError('Google Sheet range is outside the HICO GỐC column limit.', { code: 'GOOGLE_SHEET_RANGE_INVALID', status: 422 });
  }
  return { startColumn, endColumn };
};

export const validateHicoGocRange = ({ sheetRange, headers = [], fieldMapping } = {}) => {
  const range = parseHicoGocRange(sheetRange);
  const mappingEntries = Object.entries(fieldMapping ?? {}).filter(([, value]) => value !== null && value !== undefined);
  const missingMapping = mappingEntries.find(([, value]) => !Number.isInteger(value) || value < 0 || value >= HICO_GOC_MAX_COLUMN);
  if (missingMapping) {
    throw new SheetSyncError('HICO GỐC mapping trỏ tới cột không hợp lệ.', {
      code: 'MAPPING_COLUMN_OUT_OF_RANGE',
      status: 422,
      details: { field: missingMapping[0], columnIndex: missingMapping[1], headerColumns: headers.length },
    });
  }
  const requiredLastIndex = mappingEntries.reduce((last, [, value]) => Math.max(last, value), -1);
  if (range.endColumn < requiredLastIndex) {
    throw new SheetSyncError('Range hiện tại không bao phủ đủ các cột cần thiết của HICO GỐC.', {
      code: 'SHEET_RANGE_INCOMPLETE',
      status: 422,
      details: {
        configuredRange: sheetRange,
        requiredLastColumn: hicoGocColumnName(requiredLastIndex),
        configuredLastColumn: hicoGocColumnName(range.endColumn),
      },
    });
  }
  const headerLastIndex = headers.reduce((last, value, index) => String(value ?? '').trim() ? index : last, -1);
  if (headerLastIndex < requiredLastIndex) {
    const missing = mappingEntries.find(([, value]) => value > headerLastIndex);
    throw new SheetSyncError('HICO GỐC header không bao phủ đủ các cột trong mapping.', {
      code: 'MAPPING_COLUMN_OUT_OF_RANGE',
      status: 422,
      details: {
        field: missing?.[0] ?? null,
        columnIndex: missing?.[1] ?? requiredLastIndex,
        headerColumns: headerLastIndex + 1,
        requiredLastColumn: hicoGocColumnName(requiredLastIndex),
      },
    });
  }
  return {
    configuredLastColumn: hicoGocColumnName(range.endColumn),
    requiredLastColumn: hicoGocColumnName(requiredLastIndex),
    headerColumns: headerLastIndex + 1,
  };
};

export const normalizeHicoGocSettings = ({ fieldMapping, priceMapping, headerHash } = {}) => ({
  fieldMapping: normalizeHicoGocMapping(fieldMapping),
  priceMapping: normalizeHicoGocPriceMapping(priceMapping),
  headerHash: typeof headerHash === 'string' && /^[a-f0-9]{64}$/i.test(headerHash) ? headerHash.toLowerCase() : null,
});
