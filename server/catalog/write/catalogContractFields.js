import { CatalogWriteError } from './catalogWriteValidation.js';

// Minimal PDP feature card fields
export const PUBLIC_CONTENT_FIELDS = [
  'networkLabel',
  'activationPolicy',
  'hotspotSupport',
];

// Behavior:
// - input[field] === undefined → skip (client didn't include the field, preserve existing value via spread merge)
// - input[field] === null || '' → clear field (return undefined so JSON serialization drops it)
// - string → set/normalize
export const normalizePublicContent = (input, prefix) => {
  const result = {};
  for (const field of PUBLIC_CONTENT_FIELDS) {
    if (input[field] === undefined) continue;

    if (input[field] === null || input[field] === '') {
      result[field] = undefined;
      continue;
    }

    if (typeof input[field] !== 'string' || input[field].trim().length > 500) {
      throw new CatalogWriteError(`${prefix}.${field} không hợp lệ.`);
    }

    result[field] = input[field].trim();
  }
  return result;
};
