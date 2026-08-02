import { sha256, stableSerialize } from '../canonical/canonicalCatalogChecksum.js';
import { CatalogWriteError } from '../write/catalogWriteValidation.js';

const MAX_SELECTION_SIZE = 20000;

const asBoolean = (value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const contains = (value, search) => String(value ?? '').toLocaleLowerCase('vi')
  .includes(String(search).toLocaleLowerCase('vi'));

const matchesEntityFilter = (entity, filter, { productById, variants }) => {
  const product = entity.productId ? productById.get(entity.productId) : entity;
  const relatedVariants = entity.productId
    ? variants.filter((variant) => variant.productId === entity.productId)
    : variants.filter((variant) => variant.productId === entity.id);
  const variantValues = relatedVariants.length ? relatedVariants : [entity];

  if (filter.operation && product.operation !== filter.operation) return false;
  if (filter.status && product.status !== filter.status) return false;
  if (filter.supplier && !variantValues.some((item) => item.supplier === filter.supplier)) {
    return false;
  }
  if (filter.medium && !variantValues.some((item) => item.medium === filter.medium)) {
    return false;
  }
  if (filter.currency && !variantValues.some((item) => item.currency === filter.currency)) {
    return false;
  }
  if (filter.needsReview !== undefined && !variantValues.some(
    (item) => item.needsReview === filter.needsReview,
  )) return false;
  if (filter.active !== undefined && !variantValues.some(
    (item) => item.active === filter.active,
  )) return false;
  if (filter.archived !== undefined && !variantValues.some(
    (item) => Boolean(item.archived) === filter.archived,
  )) return false;
  if (filter.search && ![
    entity.id,
    entity.sku,
    entity.name,
    entity.slug,
    product?.id,
    product?.name,
    product?.slug,
  ].some((value) => contains(value, filter.search))) return false;
  return true;
};

const validateSelection = (selection) => {
  if (!selection || typeof selection !== 'object') {
    throw new CatalogWriteError('Selection là bắt buộc.', {
      status: 400,
      code: 'BULK_SELECTION_REQUIRED',
    });
  }
  if (selection.mode !== 'ids' && selection.mode !== 'filter') {
    throw new CatalogWriteError('Selection mode không hợp lệ.', {
      status: 400,
      code: 'BULK_SELECTION_MODE_INVALID',
    });
  }
  if (selection.mode === 'ids' && !Array.isArray(selection.ids)) {
    throw new CatalogWriteError('Selection ids phải là mảng.', {
      status: 400,
      code: 'BULK_SELECTION_IDS_INVALID',
    });
  }
  if (selection.mode === 'filter' && (!selection.filter || typeof selection.filter !== 'object')) {
    throw new CatalogWriteError('Selection filter là bắt buộc.', {
      status: 400,
      code: 'BULK_SELECTION_FILTER_INVALID',
    });
  }
};

export const resolveBulkSelection = ({ entityType, selection, products, variants }) => {
  validateSelection(selection);
  const entities = entityType === 'product' ? products : variants;
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const productById = new Map(products.map((product) => [product.id, product]));
  let selected;

  if (selection.mode === 'ids') {
    const ids = [...new Set(selection.ids.map((id) => String(id).trim()).filter(Boolean))];
    if (ids.length > MAX_SELECTION_SIZE) {
      throw new CatalogWriteError('Selection vượt quá giới hạn cho một bulk command.', {
        status: 413,
        code: 'BULK_SELECTION_TOO_LARGE',
      });
    }
    selected = ids.map((id) => entityById.get(id)).filter(Boolean);
  } else {
    selected = entities.filter((entity) => matchesEntityFilter(
      entity,
      selection.filter,
      { productById, variants },
    ));
    const excludedIds = new Set((selection.excludedIds ?? []).map(String));
    selected = selected.filter((entity) => !excludedIds.has(entity.id));
  }

  if (selected.length === 0) {
    throw new CatalogWriteError('Selection không có bản ghi phù hợp.', {
      status: 400,
      code: 'BULK_SELECTION_EMPTY',
    });
  }
  if (selected.length > MAX_SELECTION_SIZE) {
    throw new CatalogWriteError('Selection vượt quá giới hạn cho một bulk command.', {
      status: 413,
      code: 'BULK_SELECTION_TOO_LARGE',
    });
  }

  const ids = selected.map((entity) => entity.id).sort();
  return {
    ids,
    entities: ids.map((id) => entityById.get(id)),
    selectionHash: sha256(stableSerialize({ entityType, ids })),
  };
};

export const normalizeBulkEntityType = (entityType) => {
  if (entityType === 'product' || entityType === 'variant') return entityType;
  throw new CatalogWriteError('Loại bản ghi bulk không hợp lệ.', {
    status: 400,
    code: 'BULK_ENTITY_TYPE_INVALID',
  });
};

export const normalizeOptionalBooleanFilter = (value) => asBoolean(value);
