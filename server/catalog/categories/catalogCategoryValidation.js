import { CatalogWriteError, requireNonEmptyString, requireObject } from '../write/catalogWriteValidation.js';
import { CATEGORY_KINDS, CATEGORY_STATUSES, validateCategories } from './catalogCategories.js';

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELDS = new Set(['id', 'slug', 'name', 'parentId', 'kind', 'sortOrder', 'status']);

export const normalizeCategoryInput = (input, { partial = false } = {}) => {
  requireObject(input, 'category');
  const unknown = Object.keys(input).filter((key) => !FIELDS.has(key));
  if (unknown.length) throw new CatalogWriteError(`Category chứa field không được hỗ trợ: ${unknown.join(', ')}.`);
  const result = {};
  if (input.id !== undefined) {
    result.id = requireNonEmptyString(input.id, 'category.id');
    if (!ID_PATTERN.test(result.id)) throw new CatalogWriteError('category.id không hợp lệ.');
  }
  if (!partial || input.slug !== undefined) {
    result.slug = requireNonEmptyString(input.slug, 'category.slug').toLowerCase();
    if (!SLUG_PATTERN.test(result.slug)) throw new CatalogWriteError('category.slug không hợp lệ.');
  }
  if (!partial || input.name !== undefined) {
    result.name = requireNonEmptyString(input.name, 'category.name');
    if (result.name.length > 160) throw new CatalogWriteError('category.name quá dài.');
  }
  if (!partial || input.parentId !== undefined) {
    result.parentId = input.parentId === null || input.parentId === ''
      ? null
      : requireNonEmptyString(input.parentId, 'category.parentId');
  }
  if (!partial || input.kind !== undefined) {
    result.kind = input.kind === null || input.kind === '' ? null : input.kind;
    if (result.kind !== null && !CATEGORY_KINDS.includes(result.kind)) throw new CatalogWriteError('category.kind không hợp lệ.');
  }
  if (!partial || input.sortOrder !== undefined) {
    result.sortOrder = input.sortOrder ?? 0;
    if (!Number.isInteger(result.sortOrder) || result.sortOrder < 0) throw new CatalogWriteError('category.sortOrder không hợp lệ.');
  }
  if (input.status !== undefined) {
    if (!CATEGORY_STATUSES.includes(input.status)) throw new CatalogWriteError('category.status không hợp lệ.');
    result.status = input.status;
  }
  return result;
};

export const assertCategoryCollection = (categories) => {
  const validation = validateCategories(categories);
  if (!validation.valid) {
    throw new CatalogWriteError(validation.errors[0], {
      code: 'CATEGORY_VALIDATION_FAILED',
      details: { errors: validation.errors },
    });
  }
};
