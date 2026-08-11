import { createHash } from 'node:crypto';
import { CLEAR_VALUE, SHEET_SYNC_FIELDS, SheetSyncError } from './sheetSyncTypes.js';
import { validateSimHicoHeader, resolveSimHicoHeaders } from './simHicoHeaderAliases.js';

const HEADER_ALIASES = {
  variant_id: 'variantId', product_slug: 'productSlug', sku: 'sku', retail_price: 'price', wmproduct_id: 'wmproductId',
  apn: 'apn', network: 'networkLabel', network_label: 'networkLabel', public_note: 'publicNote', currency: 'currency', updated_at: 'updatedAt',
};
const FORMULA_ERROR = /^#(?:REF!|VALUE!|NAME\?|N\/A|DIV\/0!|NUM!|NULL!)/i;
const MOJIBAKE = /(?:\u00c3\u0192.|\u00c3\u201a.|\u00c3\u00a1\u00c2\u00bb|\u00c3\u00a2\u00e2\u201a\u00ac|[\u00c3\u00c2\u00e2\u00f0\ufffd])/;
const trimText = (value) => String(value).replace(/^\s+|\s+$/g, '').normalize('NFC');
const hash = (value) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

const cleanText = (value, field, errors) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' && typeof value !== 'number') { errors.push({ code: 'FIELD_TYPE_INVALID', field }); return undefined; }
  if (String(value).includes('\uFEFF')) errors.push({ code: 'BOM_DETECTED', field });
  const text = trimText(value);
  if (FORMULA_ERROR.test(text)) errors.push({ code: 'FORMULA_ERROR', field });
  if (MOJIBAKE.test(text)) errors.push({ code: 'MOJIBAKE_DETECTED', field });
  return text || undefined;
};

export const parsePrice = (value, errors, field = 'price') => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  const text = String(value).trim();
  if (FORMULA_ERROR.test(text)) errors.push({ code: 'FORMULA_ERROR', field });
  if (MOJIBAKE.test(text)) errors.push({ code: 'MOJIBAKE_DETECTED', field });
  if (/^\d+$/.test(text)) return Number(text);
  if (/^\d{1,3}(?:[,.]\d{3})+$/.test(text)) return Number(text.replace(/[,.]/g, ''));
  errors.push({ code: /^-/.test(text) ? 'INVALID_PRICE' : 'PRICE_INVALID', field });
  return undefined;
};

const parseDuration = (value, errors) => {
  const text = cleanText(value, 'durationDays', errors);
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 3650) { errors.push({ code: 'DURATION_INVALID', field: 'durationDays' }); return undefined; }
  return Number(text);
};

const clearValue = (value, field, errors) => {
  if (value === CLEAR_VALUE && !['apn', 'networkLabel', 'publicNote'].includes(field)) errors.push({ code: 'CLEAR_NOT_ALLOWED', field });
  if (value === CLEAR_VALUE) return null;
  return cleanText(value, field, errors);
};

const changedFields = (row) => SHEET_SYNC_FIELDS.filter((field) => row[field] !== undefined);

const makeNativeCandidate = ({ cells, rowNumber, sourceMedium, sourceSku, skuField, priceField, wmidField, columns }) => {
  const errors = [];
  const sourceSkuValue = cleanText(cells[columns.get(skuField)], 'sku', errors);
  if (!sourceSkuValue) return null;
  const row = {
    sku: sourceSkuValue,
    medium: sourceMedium,
    sourceRow: rowNumber,
    sourceMedium,
    sourceSku: sourceSkuValue,
    price: parsePrice(cells[columns.get(priceField)], errors),
    wmproductId: cleanText(cells[columns.get(wmidField)], 'wmproductId', errors),
    apn: clearValue(cells[columns.get('apn')], 'apn', errors),
    networkLabel: clearValue(cells[columns.get('networkLabel')], 'networkLabel', errors),
    publicNote: clearValue(cells[columns.get('publicNote')], 'publicNote', errors),
    durationDays: parseDuration(cells[columns.get('durationDays')], errors),
    dataType: cleanText(cells[columns.get('dataType')], 'dataType', errors),
  };
  for (const field of ['price', 'wmproductId']) if (row[field] === CLEAR_VALUE) errors.push({ code: 'CLEAR_NOT_ALLOWED', field });
  if (!changedFields(row).length) errors.push({ code: 'NO_MUTABLE_FIELDS' });
  return {
    normalizedData: row,
    sourceRow: rowNumber,
    sheetRowNumber: rowNumber,
    sourceMedium,
    sourceSku: sourceSkuValue,
    raw: { sourceRow: rowNumber, sourceMedium, sourceSku: sourceSkuValue },
    errors,
  };
};

const parseNativeRows = (values) => {
  const headerValidation = validateSimHicoHeader(values[0]);
  if (!headerValidation.valid) throw new SheetSyncError('Sim HICO header contract is invalid.', { code: 'SHEET_HEADER_CONTRACT_INVALID', status: 422, details: { missing: headerValidation.missing } });
  const columns = new Map(resolveSimHicoHeaders(values[0]).filter((item) => item.field).map((item) => [item.field, item.index]));
  const candidates = [];
  values.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const common = { cells, rowNumber, columns };
    if (headerValidation.hasPhysical) {
      const candidate = makeNativeCandidate({ ...common, sourceMedium: 'physical_sim', sourceSku: 'skuPhysical', skuField: 'skuPhysical', priceField: 'pricePhysical', wmidField: 'wmproductIdPhysical' });
      if (candidate) candidates.push(candidate);
    }
    if (headerValidation.hasEsim) {
      const candidate = makeNativeCandidate({ ...common, sourceMedium: 'esim', sourceSku: 'skuEsim', skuField: 'skuEsim', priceField: 'priceEsim', wmidField: 'wmproductIdEsim' });
      if (candidate) candidates.push(candidate);
    }
  });
  return candidates.map((row, index) => ({ ...row, id: `row-${row.sourceRow}-${row.sourceMedium}`, rowHash: hash(row.normalizedData), variantId: null, status: row.errors.length ? 'INVALID' : 'VALID', diff: {}, appliedFields: [], candidateIndex: index }));
};

const parseLegacyRows = (values) => {
  const headers = values[0].map((value) => String(value ?? '').trim().toLowerCase());
  const mapped = headers.map((header) => HEADER_ALIASES[header] ?? null);
  if (!mapped.includes('variantId') && !(mapped.includes('productSlug') && mapped.includes('sku'))) throw new SheetSyncError('Sheet must include variant_id or product_slug with sku.', { code: 'SHEET_HEADER_CONTRACT_INVALID', status: 422 });
  return values.slice(1).map((cells, index) => {
    const errors = []; const raw = {};
    mapped.forEach((field, column) => { if (field) raw[field] = cells[column]; });
    const row = {
      variantId: cleanText(raw.variantId, 'variantId', errors), productSlug: cleanText(raw.productSlug, 'productSlug', errors), sku: cleanText(raw.sku, 'sku', errors),
      price: parsePrice(raw.price, errors), wmproductId: cleanText(raw.wmproductId, 'wmproductId', errors), apn: clearValue(raw.apn, 'apn', errors), networkLabel: clearValue(raw.networkLabel, 'networkLabel', errors), publicNote: clearValue(raw.publicNote, 'publicNote', errors), currency: cleanText(raw.currency, 'currency', errors), updatedAt: cleanText(raw.updatedAt, 'updatedAt', errors),
    };
    const fields = changedFields(row);
    if (!row.variantId && !(row.productSlug && row.sku)) errors.push({ code: 'EXACT_MATCH_REQUIRED' });
    if (!fields.length) errors.push({ code: 'NO_MUTABLE_FIELDS' });
    return { id: `row-${index + 2}`, sheetRowNumber: index + 2, variantId: null, status: errors.length ? 'INVALID' : 'VALID', raw, normalizedData: row, rowHash: hash(row), errors, diff: {}, appliedFields: [] };
  });
};

export const parseSheetRows = (values = []) => {
  if (!Array.isArray(values) || values.length === 0 || !Array.isArray(values[0])) throw new SheetSyncError('Sheet does not contain a header row.', { code: 'SHEET_HEADER_REQUIRED' });
  const nativeHeader = validateSimHicoHeader(values[0]);
  return nativeHeader.valid ? parseNativeRows(values) : parseLegacyRows(values);
};

export { validateSimHicoHeader };
