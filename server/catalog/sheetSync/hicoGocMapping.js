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

export const normalizeHicoGocSettings = ({ fieldMapping, priceMapping, headerHash } = {}) => ({
  fieldMapping: normalizeHicoGocMapping(fieldMapping),
  priceMapping: normalizeHicoGocPriceMapping(priceMapping),
  headerHash: typeof headerHash === 'string' && /^[a-f0-9]{64}$/i.test(headerHash) ? headerHash.toLowerCase() : null,
});
