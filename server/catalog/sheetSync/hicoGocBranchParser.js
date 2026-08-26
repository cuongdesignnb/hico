import { parsePrice } from './sheetRowParser.js';
import { parseHicoCoverage } from '../coverage/hicoCoverageParser.js';
import { parseDurationMention, parseDurationValue } from './hicoGocDurationParser.js';
import { classifyHicoPackageClass, mediumSourceMismatch } from './hicoGocSourceClassifier.js';

export { parseDurationValue } from './hicoGocDurationParser.js';

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

export const parseActualDurationDescriptor = parseDurationMention;
export const parseActualDuration = (productName) => parseDurationMention(productName)?.value;

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
  clean(cells[mapping[wmidField]], 'wmproductId', [], []) !== undefined
);

export const makeHicoGocBranchCandidate = ({ cells, rowNumber, medium, mapping, priceMapping, skuField, wmidField, priceField }) => {
  const errors = [];
  const warnings = [];
  const sourceCategoryLabel = criticalClean(valueAt(cells, mapping, 'simType'), 'simType', errors, warnings);
  const packageClass = classifyHicoPackageClass(sourceCategoryLabel);
  const productName = criticalClean(valueAt(cells, mapping, 'productName'), 'productName', errors, warnings);
  const dataPolicy = parsePolicy(valueAt(cells, mapping, 'dataType'), errors, warnings);
  // SKU is optional source metadata. WMID is the only branch identity.
  const sku = clean(valueAt(cells, mapping, skuField), 'sku', warnings, warnings);
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

  let duration;
  let tripDayOptions;
  if (dataPolicy === 'daily') {
    const rawDuration = criticalClean(valueAt(cells, mapping, 'durationDays'), 'duration', errors, warnings);
    duration = parseDurationValue(rawDuration);
    if (!duration) errors.push({ code: 'DURATION_INVALID', field: 'duration' });
  } else if (dataPolicy === 'total') {
    duration = parseDurationMention(productName);
    if (duration === undefined) warnings.push({ code: 'DURATION_AMBIGUOUS', field: 'duration' });
    const option = clean(valueAt(cells, mapping, 'durationDays'), 'tripDayOptions', warnings, warnings);
    const parsedOption = parseDurationValue(option);
    if (parsedOption?.unit === 'day') tripDayOptions = [parsedOption.value];
    else if (option !== undefined) warnings.push({ code: 'DURATION_AMBIGUOUS', field: 'tripDayOptions' });
  }

  const rawCoverageLabel = clean(valueAt(cells, mapping, 'networkLabel'), 'rawCoverageLabel', warnings, warnings);
  const coverage = parseHicoCoverage(rawCoverageLabel);

  const normalizedData = {
    sku,
    medium,
    productName,
    rawPlanLabel: productName,
    sourceCategoryLabel,
    packageClass,
    dataPolicy,
    dataLimit: parseDataLimit(productName, dataPolicy),
    ...(duration ? {
      duration: duration.display,
      durationValue: duration.value,
      durationUnit: duration.unit,
      ...(duration.unit === 'day' ? { durationDays: duration.value } : {}),
    } : {}),
    ...(tripDayOptions ? { tripDayOptions } : {}),
    price,
    ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
    wmproductId,
    coverageLabel: rawCoverageLabel,
    rawCoverageLabel,
    coverage,
    ...(coverage.networks.length ? { networkLabel: coverage.networks.join(', ') } : {}),
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
  const branchPrefix = medium === 'esim' ? 'ESIM' : 'PHYSICAL';
  if (!wmproductId) {
    errors.push({ code: `MISSING_${branchPrefix}_WMID`, field: 'wmproductId' });
    errors.push({ code: 'MISSING_WMID', field: 'wmproductId' });
  }
  if (!productName) errors.push({ code: 'MISSING_PRODUCT_NAME', field: 'productName' });
  // A Source Type label is a package-class hint. The WMID columns are the
  // authority for branch availability, so this is observable but never invalid.
  if (mediumSourceMismatch(sourceCategoryLabel, medium)) warnings.push({ code: 'SOURCE_TYPE_MEDIUM_MISMATCH', field: 'simType' });
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
    needsReview: warnings.length > 0,
    diff: {},
    appliedFields: [],
    status: errors.length ? 'INVALID' : 'VALID',
    mode: 'quick',
  };
};
