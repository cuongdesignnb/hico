import { parsePrice } from './sheetRowParser.js';
import { mediumSourceMismatch } from './hicoGocSourceClassifier.js';

const FORMULA_ERROR = /^#(?:REF!|VALUE!|NAME\?|N\/A|DIV\/0!|NUM!|NULL!)/i;
const MOJIBAKE = /(?:\u00c3\u0192.|\u00c3\u201a.|\u00c3\u00a1\u00c2\xBB|\u00c3\u00a2\u00e2\u201a\u00ac|[\u00c3\u00c2\u00e2\u00f0\ufffd])/;
const clean = (value, field, errors, warnings = errors) => {
  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value).trim().normalize('NFC');
  if (FORMULA_ERROR.test(text)) warnings.push({ code: 'FORMULA_ERROR', field });
  if (MOJIBAKE.test(text)) warnings.push({ code: 'MOJIBAKE_DETECTED', field });
  return text || undefined;
};

const criticalClean = (value, field, errors, warnings) => {
  const local = [];
  const text = clean(value, field, errors, local);
  errors.push(...local);
  return text;
};

const number = (value, field, errors, warnings = errors) => {
  const text = criticalClean(value, field, errors, warnings);
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 3650) {
    errors.push({ code: 'DURATION_INVALID', field });
    return undefined;
  }
  return Number(text);
};

const amount = (value) => String(value).replace(',', '.').replace(/\.0+$/, '');
const quota = (text, pattern) => {
  const match = String(text ?? '').match(pattern);
  return match ? `${amount(match[1])}${match[2].toUpperCase()}` : undefined;
};

export const parseDataLimit = (productName, dataPolicy) => (
  dataPolicy === 'daily'
    ? quota(productName, /(\d+(?:[.,]\d+)?)\s*(KB|MB|GB)\s*\/\s*ngày/i)
    : quota(productName, /tổng\s*(\d+(?:[.,]\d+)?)\s*(KB|MB|GB)/i)
);

export const parseActualDuration = (productName) => {
  const match = String(productName ?? '').match(/(\d+)\s*(?:ngày|day|days)\b/i);
  return match ? Number(match[1]) : undefined;
};

export const parseSpeedLabel = (productName, warnings) => {
  const matches = [...String(productName ?? '').matchAll(/(\d+)\s*kbps\b/gi)];
  if (matches.length > 1) warnings.push({ code: 'DATA_SPEED_AMBIGUOUS', field: 'speedLabel' });
  return matches.length === 1 ? `${matches[0][1]}kbps` : undefined;
};

const parsePolicy = (value, errors, warnings) => {
  const text = criticalClean(value, 'dataPolicy', errors, warnings);
  if (text === 'Chia ngày') return 'daily';
  if (text === 'Gói tổng') return 'total';
  errors.push({ code: 'DATA_POLICY_INVALID', field: 'dataPolicy' });
  return undefined;
};

const parseCancellable = (value, warnings) => {
  const text = clean(value, 'cancellable', warnings, warnings);
  if (text === undefined) return undefined;
  if (text === 'Có thể') return true;
  if (text === 'Không thể') return false;
  warnings.push({ code: 'CANCELLABLE_INVALID', field: 'cancellable' });
  return undefined;
};

const optionalImage = (value, field, warnings) => {
  const text = clean(value, field, warnings, warnings);
  if (text === undefined) return undefined;
  if (!/^\/(?:images|uploads)\//.test(text) || text.includes('..')) {
    warnings.push({ code: 'IMAGE_SOURCE_UNSUPPORTED', field });
    return undefined;
  }
  return text;
};

const optionalGallery = (value, field, warnings) => {
  const text = clean(value, field, warnings, warnings);
  if (text === undefined) return undefined;
  const values = text.split(/[\r\n,;]+/).map((item) => item.trim()).filter(Boolean);
  return [...new Set(values.map((item) => optionalImage(item, field, warnings)).filter(Boolean))];
};

const valueAt = (cells, mapping, field) => cells[mapping[field]];
const parseSellingPrice = (value, errors, field) => {
  const local = [];
  const price = parsePrice(value, local, field);
  if (local.length) errors.push(...local);
  if (price === undefined) errors.push({ code: 'INVALID_SELLING_PRICE', field: 'price' });
  return price;
};

export const branchIdentityPresent = ({ cells, mapping, skuField, wmidField }) => (
  clean(cells[mapping[skuField]], 'sku', [], []) !== undefined
  || clean(cells[mapping[wmidField]], 'wmproductId', [], []) !== undefined
);

export const makeHicoGocBranchCandidate = ({ cells, rowNumber, medium, mapping, priceMapping, skuField, wmidField, priceField }) => {
  const errors = [];
  const warnings = [];
  const sourceCategoryLabel = criticalClean(valueAt(cells, mapping, 'simType'), 'simType', errors, warnings);
  const productName = criticalClean(valueAt(cells, mapping, 'productName'), 'productName', errors, warnings);
  const dataPolicy = parsePolicy(valueAt(cells, mapping, 'dataType'), errors, warnings);
  const sku = criticalClean(valueAt(cells, mapping, skuField), 'sku', errors, warnings);
  const wmproductId = criticalClean(valueAt(cells, mapping, wmidField), 'wmproductId', errors, warnings);
  const price = parseSellingPrice(valueAt(cells, mapping, priceMapping[priceField]), errors, 'price');
  const compareField = medium === 'physical_sim' ? 'comparePhysical' : 'compareEsim';
  const compareRaw = priceMapping[compareField] ? valueAt(cells, mapping, priceMapping[compareField]) : undefined;
  const compareIssues = [];
  const compareValue = priceMapping[compareField] ? parsePrice(compareRaw, compareIssues, 'compareAtPrice') : undefined;
  const compareAtPrice = compareValue !== undefined && compareValue > (price ?? -1) ? compareValue : undefined;
  if ((compareIssues.length > 0 || (compareRaw !== undefined && String(compareRaw).trim() !== '' && compareValue === undefined)) || (compareValue !== undefined && compareAtPrice === undefined)) {
    warnings.push({ code: 'COMPARE_PRICE_INVALID', field: 'compareAtPrice' });
  }

  let durationDays;
  let tripDayOptions;
  if (dataPolicy === 'daily') {
    durationDays = number(valueAt(cells, mapping, 'durationDays'), 'durationDays', errors, warnings);
  } else if (dataPolicy === 'total') {
    durationDays = parseActualDuration(productName);
    if (durationDays === undefined) warnings.push({ code: 'DURATION_AMBIGUOUS', field: 'duration' });
    const option = clean(valueAt(cells, mapping, 'durationDays'), 'tripDayOptions', warnings, warnings);
    if (option !== undefined && /^\d+$/.test(option) && Number(option) > 0 && Number(option) <= 3650) tripDayOptions = [Number(option)];
    else if (option !== undefined) warnings.push({ code: 'DURATION_AMBIGUOUS', field: 'tripDayOptions' });
  }

  const normalizedData = {
    sku,
    medium,
    productName,
    rawPlanLabel: productName,
    sourceCategoryLabel,
    dataPolicy,
    dataLimit: parseDataLimit(productName, dataPolicy),
    ...(durationDays ? { duration: `${durationDays} ngày`, durationDays } : {}),
    ...(tripDayOptions ? { tripDayOptions } : {}),
    price,
    ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
    wmproductId,
    coverageLabel: clean(valueAt(cells, mapping, 'networkLabel'), 'coverageLabel', warnings, warnings),
    networkLabel: clean(valueAt(cells, mapping, 'networkLabel'), 'networkLabel', warnings, warnings),
    apn: clean(valueAt(cells, mapping, 'apn'), 'apn', warnings, warnings),
    publicNote: clean(valueAt(cells, mapping, 'publicNote'), 'publicNote', warnings, warnings),
    activationPolicy: clean(valueAt(cells, mapping, 'activationPolicy'), 'activationPolicy', warnings, warnings),
    speedLabel: parseSpeedLabel(productName, warnings),
    cancellable: parseCancellable(valueAt(cells, mapping, 'cancellable'), warnings),
    ...(mapping.imageUrl !== null && mapping.imageUrl !== undefined ? { imageUrl: optionalImage(valueAt(cells, mapping, 'imageUrl'), 'imageUrl', warnings) } : {}),
    ...(mapping.galleryImageUrls !== null && mapping.galleryImageUrls !== undefined ? { galleryImageUrls: optionalGallery(valueAt(cells, mapping, 'galleryImageUrls'), 'galleryImageUrls', warnings) } : {}),
    ...(mapping.description !== null && mapping.description !== undefined ? { description: clean(valueAt(cells, mapping, 'description'), 'description', warnings, warnings) } : {}),
    ...(mapping.installationGuide !== null && mapping.installationGuide !== undefined ? { installationGuide: clean(valueAt(cells, mapping, 'installationGuide'), 'installationGuide', warnings, warnings) } : {}),
  };
  if (!sku) errors.push({ code: 'MISSING_SKU', field: 'sku' });
  if (!wmproductId) errors.push({ code: 'MISSING_WMID', field: 'wmproductId' });
  if (!productName) errors.push({ code: 'MISSING_PRODUCT_NAME', field: 'productName' });
  if (!sku || !wmproductId) errors.push({ code: 'INVALID_BRANCH_PAIR', field: medium });
  if (mediumSourceMismatch(sourceCategoryLabel, medium)) warnings.push({ code: 'MEDIUM_SOURCE_MISMATCH', field: 'simType' });
  if (!normalizedData.dataLimit) warnings.push({ code: 'DATA_LIMIT_AMBIGUOUS', field: 'dataLimit' });

  return {
    id: `hico-goc-${rowNumber}-${medium}`,
    sheetRowNumber: rowNumber,
    sourceRow: rowNumber,
    sourceMedium: medium,
    sourceSku: sku,
    normalizedData,
    rowHash: JSON.stringify([rowNumber, normalizedData]),
    errors,
    warnings,
    diff: {},
    appliedFields: [],
    status: errors.length ? 'INVALID' : 'VALID',
    mode: 'quick',
  };
};
