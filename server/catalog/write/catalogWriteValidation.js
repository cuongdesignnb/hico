import { sha256, stableSerialize } from '../canonical/canonicalCatalogChecksum.js';

export class CatalogWriteError extends Error {
  constructor(message, {
    status = 400,
    code,
    details,
  } = {}) {
    super(message);
    this.name = 'CatalogWriteError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const requireObject = (value, fieldName) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CatalogWriteError(`${fieldName} phải là object.`);
  }
  return value;
};

export const requireNonEmptyString = (value, fieldName) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CatalogWriteError(`${fieldName} không được để trống.`);
  }
  return value.trim();
};

export const requirePositiveVersion = (value, fieldName = 'version') => {
  if (!Number.isInteger(value) || value < 1) {
    throw new CatalogWriteError(`${fieldName} phải là số nguyên dương.`);
  }
  return value;
};

export const requireCatalogVersionId = (value) => (
  requireNonEmptyString(value, 'catalogVersionId')
);

export const requireIdempotencyKey = (value) => {
  const key = requireNonEmptyString(value, 'idempotencyKey');
  if (key.length > 200) {
    throw new CatalogWriteError('idempotencyKey quá dài.');
  }
  return key;
};

export const requestHash = (operation, request) => sha256(stableSerialize({
  operation,
  request,
}));

export const changedFields = (before, after) => {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  return [...keys]
    .filter((key) => stableSerialize(before?.[key]) !== stableSerialize(after?.[key]))
    .sort();
};

export const assertCanonicalWriteSource = (env) => {
  if ((env.CATALOG_READ_SOURCE ?? 'canonical') !== 'canonical') {
    throw new CatalogWriteError(
      'Canonical write chỉ khả dụng khi CATALOG_READ_SOURCE=canonical.',
      { status: 409, code: 'CANONICAL_WRITE_DISABLED' },
    );
  }
};

export const assertCatalogBaseVersion = (expected, actual) => {
  if (expected !== actual) {
    throw new CatalogWriteError(
      'Catalog đã có phiên bản mới. Vui lòng tải lại dữ liệu.',
      { status: 409, code: 'CATALOG_VERSION_CONFLICT' },
    );
  }
};

export const assertEntityVersion = (expected, actual) => {
  if (expected !== actual) {
    throw new CatalogWriteError(
      'Dữ liệu đã được cập nhật bởi người dùng khác. Vui lòng tải lại.',
      { status: 409, code: 'ENTITY_VERSION_CONFLICT' },
    );
  }
};
