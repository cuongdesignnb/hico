import { CatalogWriteError } from './catalogWriteValidation.js';

export const PUBLIC_CONTENT_FIELDS = [
  'networkLabel',
  'coverageLabel',
  'speedLabel',
  'hotspotSupport',
  'activationPolicy',
  'resetPolicy',
  'installationGuide',
  'compatibilityContent',
  'apnGuidance',
  'instantDeliveryLabel',
  'instructions',
  'eligibilityNote',
  'packageContents',
  'deliveryNote',
  'simSize',
];

const DEVICE_STRING_FIELDS = new Set([
  'brand', 'model', 'networkGeneration', 'formFactor', 'wifiStandard',
  'batteryCapacity', 'simCompatibility', 'dimensions', 'weight', 'color',
]);
const DEVICE_NUMBER_FIELDS = new Set([
  'maxConnectedDevices', 'ethernetPorts', 'usbPorts', 'warrantyMonths',
]);
const DEVICE_ARRAY_FIELDS = new Set(['supportedBands']);

export const normalizeDeviceSpecifications = (value, fieldName = 'deviceSpecifications') => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new CatalogWriteError(`${fieldName} phải là object.`);
  }
  const unknown = Object.keys(value).filter((key) => (
    !DEVICE_STRING_FIELDS.has(key)
    && !DEVICE_NUMBER_FIELDS.has(key)
    && !DEVICE_ARRAY_FIELDS.has(key)
  ));
  if (unknown.length) throw new CatalogWriteError(`${fieldName} chứa field không được hỗ trợ: ${unknown.join(', ')}.`);
  const result = {};
  for (const field of DEVICE_STRING_FIELDS) {
    if (value[field] !== undefined && value[field] !== null && value[field] !== '') {
      if (typeof value[field] !== 'string' || value[field].trim().length > 240) throw new CatalogWriteError(`${fieldName}.${field} không hợp lệ.`);
      result[field] = value[field].trim();
    }
  }
  for (const field of DEVICE_NUMBER_FIELDS) {
    if (value[field] !== undefined && value[field] !== null) {
      if (!Number.isInteger(value[field]) || value[field] < 0) throw new CatalogWriteError(`${fieldName}.${field} phải là số nguyên không âm.`);
      result[field] = value[field];
    }
  }
  if (value.supportedBands !== undefined) {
    if (!Array.isArray(value.supportedBands) || value.supportedBands.some((band) => typeof band !== 'string' || band.trim() === '')) throw new CatalogWriteError(`${fieldName}.supportedBands không hợp lệ.`);
    result.supportedBands = value.supportedBands.map((band) => band.trim()).slice(0, 64);
  }
  return Object.keys(result).length ? result : undefined;
};

export const normalizePublicContent = (input, prefix) => {
  const result = {};
  for (const field of PUBLIC_CONTENT_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') continue;
    if (typeof input[field] !== 'string' || input[field].trim().length > 5000) throw new CatalogWriteError(`${prefix}.${field} không hợp lệ.`);
    result[field] = input[field].trim();
  }
  return result;
};

export const normalizeFaqItems = (value, fieldName = 'faqItems') => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > 50) throw new CatalogWriteError(`${fieldName} không hợp lệ.`);
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new CatalogWriteError(`${fieldName}[${index}] không hợp lệ.`);
    if (typeof item.question !== 'string' || typeof item.answer !== 'string' || !item.question.trim() || !item.answer.trim()) throw new CatalogWriteError(`${fieldName}[${index}] cần question và answer.`);
    return {
      question: item.question.trim().slice(0, 500),
      answer: item.answer.trim().slice(0, 5000),
      sortOrder: Number.isInteger(item.sortOrder) && item.sortOrder >= 0 ? item.sortOrder : index,
    };
  });
};

const normalizeMediaItem = (value, index, fieldName) => {
  const item = typeof value === 'string' ? { url: value } : value;
  if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.url !== 'string') throw new CatalogWriteError(`${fieldName}[${index}] không hợp lệ.`);
  if (!/^\/(?:images|uploads)\//.test(item.url) || item.url.includes('..')) throw new CatalogWriteError(`${fieldName}[${index}].url phải là media local hợp lệ.`);
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `media-${index + 1}`,
    url: item.url,
    alt: typeof item.alt === 'string' ? item.alt.trim().slice(0, 240) : '',
    ...(typeof item.title === 'string' && item.title.trim() ? { title: item.title.trim().slice(0, 240) } : {}),
    sortOrder: Number.isInteger(item.sortOrder) && item.sortOrder >= 0 ? item.sortOrder : index,
  };
};

export const normalizeMedia = (value, fieldName = 'gallery') => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > 50) throw new CatalogWriteError(`${fieldName} không hợp lệ.`);
  const seen = new Set();
  return value.map((item, index) => {
    const media = normalizeMediaItem(item, index, fieldName);
    if (seen.has(media.url)) throw new CatalogWriteError(`${fieldName} không được trùng URL.`);
    seen.add(media.url);
    return media;
  });
};
