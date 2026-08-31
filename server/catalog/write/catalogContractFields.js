import { CatalogWriteError } from './catalogWriteValidation.js';

// Minimal PDP feature card fields
export const PUBLIC_CONTENT_FIELDS = [
  'networkLabel',
  'activationPolicy',
  'hotspotSupport',
];

export const normalizePublicContent = (input, prefix) => {
  const result = {};
  for (const field of PUBLIC_CONTENT_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') continue;
    if (typeof input[field] !== 'string' || input[field].trim().length > 500) {
      throw new CatalogWriteError(`${prefix}.${field} không hợp lệ.`);
    }
    result[field] = input[field].trim();
  }
  return result;
};
