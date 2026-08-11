const FAMILY_FIELDS = Object.freeze([
  'provider',
  'region',
  'medium',
  'dataPolicy',
  'speedPolicy',
  'networkPolicy',
  'activationPolicy',
  'resetPolicy',
  'operationType',
]);

export const FAMILY_REQUIRED_FIELDS = Object.freeze([
  'provider',
  'region',
  'medium',
  'dataPolicy',
  'speedPolicy',
  'operationType',
]);

export const FAMILY_OPTIONAL_FIELDS = Object.freeze([
  'networkPolicy',
  'activationPolicy',
  'resetPolicy',
]);

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().normalize('NFC');
  return normalized || null;
};

const foldedText = (value) => normalizeText(value)
  ?.replace(/đ/gi, 'd')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase() ?? null;

const firstValue = (source, names) => {
  for (const name of names) {
    const value = source?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
};

const code = (value) => foldedText(value)
  ?.replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toUpperCase() || null;

export const normalizeProvider = (value) => {
  const normalized = foldedText(value);
  if (!normalized) return null;
  if (normalized === 'worldmove') return 'WORLDMOVE';
  return code(normalized);
};

const normalizeMedium = (value) => {
  if (value === 0 || value === '0') return 'ESIM';
  if (value === 1 || value === '1') return 'PHYSICAL_SIM';
  const normalized = foldedText(value);
  if (!normalized) return null;
  if (['esim', 'e_sim', 'e-sim', 'lesim'].includes(normalized)) return 'ESIM';
  if (['physical', 'physical_sim', 'physical-sim', 'sim', 'physical sim'].includes(normalized)) return 'PHYSICAL_SIM';
  return code(normalized);
};

const mediumFor = (source) => {
  const explicit = firstValue(source, ['medium', 'simType', 'legacySimType']);
  if (explicit !== null) return normalizeMedium(explicit);
  if (source?.providerProductType === 1) return 'PHYSICAL_SIM';
  if (source?.providerProductType === 0 && source?.leSIM === true) return 'ESIM';
  return null;
};

export const normalizeRegion = (value) => {
  const normalized = foldedText(value);
  if (!normalized) return null;
  if (['cn', 'china', 'mainland_china', 'china_mainland', 'trung_quoc'].includes(normalized.replace(/\s+/g, '_'))) return 'CN';
  if (['vn', 'vietnam', 'viet_nam', 'viet nam'].includes(normalized)) return 'VN';
  return code(normalized);
};

const numericAmount = (value) => Number.isInteger(value) || (typeof value === 'number' && Number.isFinite(value))
  ? String(value)
  : null;

const normalizeUnit = (value) => {
  const normalized = foldedText(value);
  if (!normalized) return null;
  if (['kb', 'kbyte', 'kilobyte'].includes(normalized)) return 'KB';
  if (['mb', 'mbyte', 'megabyte'].includes(normalized)) return 'MB';
  if (['gb', 'gbyte', 'gigabyte'].includes(normalized)) return 'GB';
  return code(normalized);
};

export const normalizeDataPolicy = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const policy = code(value.policy ?? value.type);
    const amount = numericAmount(value.quotaAmount ?? value.amount);
    const unit = normalizeUnit(value.quotaUnit ?? value.unit);
    const period = code(value.quotaPeriod ?? value.period);
    if (policy === 'DAILY_QUOTA' && amount && unit && period === 'DAY') return `DAILY_QUOTA:${amount}:${unit}:DAY`;
    if (policy === 'TOTAL_QUOTA' && amount && unit) return `TOTAL_QUOTA:${amount}:${unit}`;
    return null;
  }
  const normalized = foldedText(value);
  if (!normalized) return null;
  if (/^daily_quota:\d+(?:\.\d+)?:[a-z]+:day$/.test(normalized)) {
    const [, amount, unit] = normalized.split(':');
    return `DAILY_QUOTA:${amount}:${normalizeUnit(unit)}:DAY`;
  }
  if (/^total_quota:\d+(?:\.\d+)?:[a-z]+$/.test(normalized)) {
    const [, amount, unit] = normalized.split(':');
    return `TOTAL_QUOTA:${amount}:${normalizeUnit(unit)}`;
  }
  const daily = normalized.match(/(\d+(?:\.\d+)?)\s*(kb|mb|gb)\s*(?:\/\s*|per\s+|\s+)(day|ngay|d)\b/i);
  if (daily) return `DAILY_QUOTA:${daily[1]}:${normalizeUnit(daily[2])}:DAY`;
  const total = normalized.match(/^(?:total\s+)?(\d+(?:\.\d+)?)\s*(kb|mb|gb)(?:\s+total)?$/i);
  if (total) return `TOTAL_QUOTA:${total[1]}:${normalizeUnit(total[2])}`;
  return code(normalized);
};

export const normalizeSpeedPolicy = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const throttle = Number(value.throttleKbps ?? value.kbps);
    if (Number.isFinite(throttle) && throttle > 0) return `THROTTLE_KBPS:${throttle}:AFTER_QUOTA`;
    return null;
  }
  const normalized = foldedText(value);
  if (!normalized) return null;
  const canonical = normalized.match(/^throttle_kbps:(\d+(?:\.\d+)?):after_quota$/i);
  if (canonical) return `THROTTLE_KBPS:${canonical[1]}:AFTER_QUOTA`;
  const throttle = normalized.match(/(\d+(?:\.\d+)?)\s*kbps(?:\s*(?:after|sau)\s*(?:quota|limit|dinh_muc))?/i);
  if (throttle) return `THROTTLE_KBPS:${throttle[1]}:AFTER_QUOTA`;
  return code(normalized);
};

const normalizeNetwork = (value) => {
  const normalized = foldedText(value);
  if (!normalized) return null;
  const networks = [];
  if (normalized.includes('china mobile') || normalized.includes('mobile')) networks.push('CN_MOBILE');
  if (normalized.includes('china unicom') || normalized.includes('unicom')) networks.push('CN_UNICOM');
  if (normalized.includes('china telecom') || normalized.includes('telecom')) networks.push('CN_TELECOM');
  if (networks.length) return [...new Set(networks)].sort().join('+');
  return code(normalized);
};

const normalizeOperation = (value) => {
  const normalized = foldedText(value);
  if (!normalized) return null;
  if (['data_only', 'data-only', 'data'].includes(normalized)) return 'DATA_ONLY';
  if (['new_subscription', 'new-subscription', 'new subscription'].includes(normalized)) return 'NEW_SUBSCRIPTION';
  if (['top_up', 'top-up', 'topup'].includes(normalized)) return 'TOPUP';
  return code(normalized);
};

const normalizePolicy = (value) => code(value);

export const familyDescriptorFor = (source = {}) => ({
  provider: normalizeProvider(firstValue(source, ['providerEligibility', 'provider', 'supplier'])),
  region: normalizeRegion(firstValue(source, ['regionCode', 'region', 'destination', 'productRegion', 'productRegionId', 'coverage', 'coverageId'])),
  medium: mediumFor(source),
  dataPolicy: normalizeDataPolicy(firstValue(source, ['dataPolicy', 'dataAllowance', 'dataLimit', 'dataType'])),
  speedPolicy: normalizeSpeedPolicy(firstValue(source, ['speedPolicy', 'speed', 'throttlePolicy', 'throttle'])),
  networkPolicy: normalizeNetwork(firstValue(source, ['networkPolicy', 'networkCoverage', 'networkLabel', 'network'])),
  activationPolicy: normalizePolicy(firstValue(source, ['activationPolicy', 'activation'])),
  resetPolicy: normalizePolicy(firstValue(source, ['resetPolicy', 'reset'])),
  operationType: normalizeOperation(firstValue(source, ['operationType', 'operation'])),
});

export const familyMetadataStatus = (source = {}) => {
  const descriptor = familyDescriptorFor(source);
  const missingRequired = FAMILY_REQUIRED_FIELDS.filter((field) => !descriptor[field]);
  return {
    descriptor,
    missingRequired,
    complete: missingRequired.length === 0,
  };
};

export const familyKeyFor = (source = {}) => {
  const { descriptor, complete } = familyMetadataStatus(source);
  if (!complete) return null;
  return FAMILY_FIELDS
    .filter((field) => descriptor[field] !== null)
    .map((field) => `${field}=${descriptor[field]}`)
    .join('|');
};

export const compatibilityFields = () => [...FAMILY_FIELDS];

export const sameMedium = (left, right) => {
  const leftMedium = familyDescriptorFor(left).medium;
  const rightMedium = familyDescriptorFor(right).medium;
  return Boolean(leftMedium && rightMedium && leftMedium === rightMedium);
};

export const isCompatibleFamily = ({ variant, offer }) => {
  const left = familyMetadataStatus(variant);
  const right = familyMetadataStatus(offer);
  if (!left.complete || !right.complete || !sameMedium(variant, offer)) return false;
  for (const field of FAMILY_REQUIRED_FIELDS) {
    if (left.descriptor[field] !== right.descriptor[field]) return false;
  }
  for (const field of FAMILY_OPTIONAL_FIELDS) {
    if (left.descriptor[field] && right.descriptor[field] && left.descriptor[field] !== right.descriptor[field]) return false;
  }
  return true;
};

export const durationDaysForVariant = (variant = {}) => {
  if (Number.isInteger(variant.durationDays) && variant.durationDays > 0) return variant.durationDays;
  if (typeof variant.duration === 'string') {
    const match = variant.duration.match(/^(\d+)\s*(?:ngày|day|days)$/i);
    if (match) return Number.parseInt(match[1], 10);
  }
  return null;
};

export const durationDaysForOffer = (offer = {}) => (
  Number.isInteger(offer.durationDays) && offer.durationDays > 0 ? offer.durationDays : null
);

export const providerForOffer = (offer) => (
  normalizeProvider(offer?.provider) === 'WORLDMOVE' ? 'WORLDMOVE' : null
);

export const mediumForSource = mediumFor;
