import { createHash } from 'node:crypto';

export const normalizeIdentityToken = (value) => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
const hash = (value) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex').slice(0, 24);

const slugToken = (value) => normalizeIdentityToken(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 72);

export const coverageFilterFor = (rawLabel) => {
  const raw = typeof rawLabel === 'string' ? rawLabel.normalize('NFC').trim() : '';
  if (!raw) return { rawLabel: '', normalizedLabel: undefined, id: undefined };
  const normalizedLabel = normalizeIdentityToken(raw);
  return { rawLabel: raw, normalizedLabel, id: `coverage-${slugToken(raw) || hash(normalizedLabel).slice(0, 10)}` };
};

export const packageFamilyPartsFor = (data = {}) => [
  normalizeIdentityToken(data.productName ?? data.packageLabel),
];

export const packageFamilyKeyFor = (data = {}) => `hico-family:${hash(packageFamilyPartsFor(data))}`;

export const productSourceKeyFor = (data = {}) => `hico-goc:${hash([
  packageFamilyKeyFor(data),
  normalizeIdentityToken(data.operation),
  normalizeIdentityToken(data.medium),
])}`;

export const variantSourceKeyFor = (data = {}) => `hico-goc-variant:${hash([
  productSourceKeyFor(data),
  normalizeIdentityToken(data.sku),
  normalizeIdentityToken(data.wmproductId),
  normalizeIdentityToken(data.dataPolicy),
  normalizeIdentityToken(data.durationDays ?? data.duration),
  normalizeIdentityToken(data.dataLimit),
])}`;

export const legacyProductSourceKeyFor = (data = {}) => `hico-goc:${hash([
  normalizeIdentityToken(data.productName),
  normalizeIdentityToken(data.dataPolicy),
  normalizeIdentityToken(data.dataLimit),
  normalizeIdentityToken(data.networkLabel),
  normalizeIdentityToken(data.medium ?? data.sourceMedium),
])}`;

export const legacyVariantSourceKeyFor = (data = {}) => `hico-goc-variant:${hash([
  normalizeIdentityToken(data.sku),
  normalizeIdentityToken(data.medium),
  normalizeIdentityToken(data.wmproductId),
])}`;
