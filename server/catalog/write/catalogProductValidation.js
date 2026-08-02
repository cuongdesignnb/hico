import sanitizeHtml from 'sanitize-html';
import {
  CatalogWriteError,
  requireNonEmptyString,
  requireObject,
} from './catalogWriteValidation.js';

const OPERATIONS = new Set(['new_subscription', 'topup', 'device_sale']);
const COVERAGE_TYPES = new Set([
  'country',
  'region',
  'global',
  'not_applicable',
]);
const STATUSES = new Set(['active', 'draft', 'archived']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const LOCAL_IMAGE_PATTERN = /^\/(?:images|uploads)\/(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9._/-]+$/;

const PRODUCT_FIELDS = new Set([
  'id',
  'name',
  'slug',
  'operation',
  'coverageType',
  'coverageIds',
  'image',
  'description',
  'guide',
  'featured',
  'seoTitle',
  'seoDescription',
  'seoKeywords',
]);

const HTML_OPTIONS = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u',
    'ul', 'ol', 'li', 'h2', 'h3', 'h4',
    'a', 'img', 'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
    }),
  },
};

export const sanitizeCatalogHtml = (value) => (
  typeof value === 'string' ? sanitizeHtml(value, HTML_OPTIONS) : value
);

const optionalString = (value, fieldName, maxLength) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new CatalogWriteError(`${fieldName} phải là chuỗi.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new CatalogWriteError(`${fieldName} quá dài.`);
  }
  return normalized;
};

const validateCoverage = (coverageType, coverageIds) => {
  if (!COVERAGE_TYPES.has(coverageType)) {
    throw new CatalogWriteError('coverageType không hợp lệ.');
  }
  if (
    !Array.isArray(coverageIds)
    || coverageIds.some((id) => typeof id !== 'string' || id.trim() === '')
  ) {
    throw new CatalogWriteError('coverageIds không hợp lệ.');
  }
  if (coverageType === 'country' && coverageIds.length !== 1) {
    throw new CatalogWriteError('Sản phẩm country phải có đúng một coverageId.');
  }
  if (coverageType === 'region' && coverageIds.length < 1) {
    throw new CatalogWriteError('Sản phẩm region phải có ít nhất một coverageId.');
  }
  if (coverageType === 'not_applicable' && coverageIds.length !== 0) {
    throw new CatalogWriteError(
      'Sản phẩm not_applicable không được có coverageId.',
    );
  }
  if (coverageType === 'global' && (
    coverageIds.length > 1
    || (coverageIds.length === 1 && coverageIds[0] !== 'global')
  )) {
    throw new CatalogWriteError('coverageIds của sản phẩm global không hợp lệ.');
  }
};

export const normalizeProductInput = (input, { partial = false } = {}) => {
  requireObject(input, 'product');
  const unknownFields = Object.keys(input).filter((key) => !PRODUCT_FIELDS.has(key));
  if (unknownFields.length) {
    throw new CatalogWriteError(
      `Product chứa field không được hỗ trợ: ${unknownFields.join(', ')}.`,
    );
  }

  const result = {};
  if (input.id !== undefined) {
    const id = requireNonEmptyString(input.id, 'product.id');
    if (!ID_PATTERN.test(id)) throw new CatalogWriteError('product.id không hợp lệ.');
    result.id = id;
  }
  if (!partial || input.name !== undefined) {
    result.name = requireNonEmptyString(input.name, 'product.name');
    if (result.name.length > 240) throw new CatalogWriteError('product.name quá dài.');
  }
  if (!partial || input.slug !== undefined) {
    result.slug = requireNonEmptyString(input.slug, 'product.slug');
    if (!SLUG_PATTERN.test(result.slug)) {
      throw new CatalogWriteError(
        'Slug phải viết thường, không dấu và chỉ dùng dấu gạch ngang.',
      );
    }
  }
  if (!partial || input.operation !== undefined) {
    result.operation = input.operation;
    if (!OPERATIONS.has(result.operation)) {
      throw new CatalogWriteError('operation không hợp lệ.');
    }
  }
  if (!partial || input.coverageType !== undefined || input.coverageIds !== undefined) {
    if (partial && (
      input.coverageType === undefined
      || input.coverageIds === undefined
    )) {
      throw new CatalogWriteError(
        'coverageType và coverageIds phải được cập nhật cùng nhau.',
      );
    }
    result.coverageType = input.coverageType;
    result.coverageIds = input.coverageIds?.map((id) => id.trim());
    validateCoverage(result.coverageType, result.coverageIds);
  }
  if (input.image !== undefined) {
    const image = optionalString(input.image, 'product.image', 500);
    if (image && !LOCAL_IMAGE_PATTERN.test(image)) {
      throw new CatalogWriteError(
        'image phải nằm dưới /images/ hoặc /uploads/.',
      );
    }
    result.image = image;
  }
  for (const field of ['description', 'guide']) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== 'string') {
        throw new CatalogWriteError(`${field} phải là chuỗi HTML.`);
      }
      result[field] = sanitizeCatalogHtml(input[field]);
    }
  }
  if (input.featured !== undefined) {
    if (typeof input.featured !== 'boolean') {
      throw new CatalogWriteError('featured phải là boolean.');
    }
    result.featured = input.featured;
  }
  for (const field of ['seoTitle', 'seoDescription', 'seoKeywords']) {
    if (input[field] !== undefined) {
      result[field] = optionalString(input[field], `product.${field}`, 500);
    }
  }
  return result;
};

export const validateProductRecord = (product) => {
  const errors = [];
  try {
    normalizeProductInput({
      id: product.id,
      name: product.name,
      slug: product.slug,
      operation: product.operation,
      coverageType: product.coverageType,
      coverageIds: product.coverageIds,
      image: product.image,
      description: product.description,
      guide: product.guide,
      featured: product.featured,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      seoKeywords: product.seoKeywords,
    });
  } catch (error) {
    errors.push({
      code: 'INVALID_PRODUCT',
      message: error.message,
    });
  }
  if (!STATUSES.has(product.status)) {
    errors.push({ code: 'INVALID_STATUS', message: 'status không hợp lệ.' });
  }
  if (!Number.isInteger(product.version) || product.version < 1) {
    errors.push({ code: 'INVALID_VERSION', message: 'version không hợp lệ.' });
  }
  for (const field of ['createdAt', 'updatedAt']) {
    if (
      typeof product[field] !== 'string'
      || Number.isNaN(Date.parse(product[field]))
    ) {
      errors.push({
        code: 'INVALID_TIMESTAMP',
        message: `${field} không hợp lệ.`,
      });
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
};

