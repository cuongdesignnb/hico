import { getProductPublishReadiness, getVariantPublishReadiness } from '../write/catalogPublishReadiness.js';
import { CatalogWriteError } from '../write/catalogWriteValidation.js';

export const BULK_OPERATIONS = new Set([
  'PUBLISH',
  'UNPUBLISH',
  'ARCHIVE',
  'RESTORE',
  'ADJUST_PRICE',
  'SET_PRICE',
  'SET_COMPARE_PRICE',
  'CLEAR_COMPARE_PRICE',
  'SET_PROVIDER_MAPPING',
  'CLEAR_PROVIDER_MAPPING',
  'SET_FULFILLMENT_SOURCE',
  'RUN_READINESS',
  'SET_FEATURED',
  'UNSET_FEATURED',
]);

const expectedWorldmoveMethod = (offer) => {
  if (offer.providerProductType === 0 && offer.leSIM === true) return 'WORLDMOVE_ESIM_REDEEM';
  if (offer.providerProductType === 0 && offer.leSIM === false) return 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM';
  if (offer.providerProductType === 1) return 'WORLDMOVE_PHYSICAL_ORDER';
  if (offer.providerProductType === 2) return 'WORLDMOVE_TOPUP';
  return undefined;
};

const operationError = (code, message, details) => ({ code, message, ...(details ? { details } : {}) });

const finiteNumber = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) {
    throw new CatalogWriteError(`${field} phải là số hữu hạn, không âm.`, {
      status: 400,
      code: 'BULK_NUMBER_INVALID',
    });
  }
  return number;
};

const priceChange = (variant, operation) => {
  if (operation.currency && variant.currency !== operation.currency) {
    return { error: operationError('CURRENCY_MISMATCH', 'Bulk price không được trộn VND và USD.') };
  }
  let nextPrice = variant.price;
  if (operation.type === 'SET_PRICE') nextPrice = finiteNumber(operation.value, 'Giá');
  if (operation.type === 'ADJUST_PRICE') {
    const value = Number(operation.value);
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      return { error: operationError('BULK_NUMBER_INVALID', 'Mức điều chỉnh giá không hợp lệ.') };
    }
    if (operation.mode === 'percent') nextPrice = variant.price * (1 + value / 100);
    else if (operation.mode === 'fixed') nextPrice = variant.price + value;
    else return { error: operationError('PRICE_MODE_INVALID', 'Kiểu điều chỉnh giá không hợp lệ.') };
  }
  if (!Number.isFinite(nextPrice) || nextPrice < 0 || nextPrice > Number.MAX_SAFE_INTEGER) {
    return { error: operationError('PRICE_INVALID', 'Giá sau thay đổi không hợp lệ.') };
  }
  return { nextPrice };
};

const compareChange = (variant, operation) => {
  if (operation.type === 'CLEAR_COMPARE_PRICE') return { nextCompareAtPrice: null };
  if (operation.currency && variant.currency !== operation.currency) {
    return { error: operationError('CURRENCY_MISMATCH', 'Bulk price không được trộn VND và USD.') };
  }
  const nextCompareAtPrice = finiteNumber(operation.value, 'Giá niêm yết');
  if (nextCompareAtPrice < variant.price) {
    return { error: operationError('COMPARE_PRICE_INVALID', 'Giá niêm yết phải lớn hơn hoặc bằng giá bán.') };
  }
  return { nextCompareAtPrice };
};

const mappingChange = ({ variant, product, operation, providerOffers }) => {
  if (operation.type === 'CLEAR_PROVIDER_MAPPING') {
    return {
      supplier: 'other',
      fulfillmentMethod: 'MANUAL_PROCESSING',
      providerOfferId: undefined,
      wmproductId: undefined,
      providerProductId: undefined,
      leSIM: undefined,
      providerProductType: null,
      active: false,
      needsReview: true,
      requiresExistingSim: false,
    };
  }
  const offer = providerOffers.find((item) => item.id === operation.providerOfferId);
  if (!offer) return { error: operationError('PROVIDER_OFFER_NOT_FOUND', 'Không tìm thấy offer provider.') };
  if (!offer.active) return { error: operationError('PROVIDER_OFFER_INACTIVE', 'Offer provider đang inactive.') };
  if (!offer.wmproductId) return { error: operationError('PROVIDER_OFFER_INVALID', 'Offer provider thiếu mã sản phẩm.') };
  const providerMethod = expectedWorldmoveMethod(offer);
  const expectedType = product.operation === 'topup'
    ? 2
    : variant.medium === 'physical_sim' ? 1 : 0;
  if (offer.providerProductType !== expectedType) {
    return { error: operationError('PROVIDER_METHOD_MISMATCH', 'Offer provider không đúng loại fulfillment.') };
  }
  const medium = offer.providerProductType === 0 ? 'esim' : 'physical_sim';
  return {
    supplier: 'worldmove',
    medium,
    fulfillmentMethod: providerMethod,
    providerOfferId: offer.id,
    wmproductId: offer.wmproductId,
    providerProductId: offer.providerProductId,
    leSIM: offer.leSIM,
    providerProductType: offer.providerProductType,
    requiresExistingSim: providerMethod === 'WORLDMOVE_TOPUP',
    shippingRequired: providerMethod === 'WORLDMOVE_PHYSICAL_ORDER',
    active: false,
    needsReview: false,
  };
};

const readiness = ({ entityType, entity, product, products, variants, providerOffers }) => {
  if (entityType === 'product') return getProductPublishReadiness({
    product: entity,
    products,
    variants,
    providerOffers,
  });
  return getVariantPublishReadiness({
    variant: entity,
    product,
    products,
    variants,
    providerOffers,
  });
};

const readinessErrors = (result) => result.errors.map((error) => operationError(error.code, error.message));

export const normalizeBulkOperation = (operation) => {
  if (!operation || typeof operation !== 'object' || !BULK_OPERATIONS.has(operation.type)) {
    throw new CatalogWriteError('Bulk operation không hợp lệ.', {
      status: 400,
      code: 'BULK_OPERATION_INVALID',
    });
  }
  return operation;
};

export const applyBulkOperation = ({
  entityType,
  entity,
  product,
  products,
  variants,
  operation,
  providerOffers,
}) => {
  const next = { ...entity };
  const errors = [];
  const warnings = [];
  const changedFields = [];

  const set = (field, value) => {
    if (next[field] !== value) {
      next[field] = value;
      changedFields.push(field);
    }
  };

  if (['SET_FEATURED', 'UNSET_FEATURED'].includes(operation.type) && entityType !== 'product') {
    errors.push(operationError('OPERATION_ENTITY_MISMATCH', 'Featured chỉ áp dụng cho sản phẩm.'));
  } else if (['ADJUST_PRICE', 'SET_PRICE', 'SET_COMPARE_PRICE', 'CLEAR_COMPARE_PRICE', 'SET_PROVIDER_MAPPING', 'CLEAR_PROVIDER_MAPPING', 'SET_FULFILLMENT_SOURCE'].includes(operation.type) && entityType !== 'variant') {
    errors.push(operationError('OPERATION_ENTITY_MISMATCH', 'Thao tác này chỉ áp dụng cho gói bán.'));
  } else if (operation.type === 'PUBLISH') {
    if (entityType === 'product') set('status', 'active');
    else set('active', true);
    const currentProduct = entityType === 'product' ? next : product;
    const result = readiness({
      entityType,
      entity: entityType === 'product' ? next : next,
      product: currentProduct,
      products: entityType === 'product' ? products.map((item) => (item.id === entity.id ? next : item)) : products,
      variants: entityType === 'variant' ? variants.map((item) => (item.id === entity.id ? next : item)) : variants,
      providerOffers,
    });
    errors.push(...readinessErrors(result));
    warnings.push(...result.warnings);
    if (entityType === 'product') {
      const productVariants = variants.filter((item) => item.productId === entity.id && !item.archived);
      const activePublishable = productVariants.some((item) => item.active && getVariantPublishReadiness({
        variant: item,
        product: next,
        products,
        variants,
        providerOffers,
      }).publishable);
      if (!activePublishable) errors.push(operationError('NO_ACTIVE_PUBLISHABLE_VARIANT', 'Sản phẩm chưa có gói bán active và đủ điều kiện publish.'));
    }
  } else if (operation.type === 'UNPUBLISH') {
    if (entityType === 'product') set('status', 'draft');
    else set('active', false);
  } else if (operation.type === 'ARCHIVE') {
    set(entityType === 'product' ? 'status' : 'archived', entityType === 'product' ? 'archived' : true);
    if (entityType === 'variant') set('active', false);
  } else if (operation.type === 'RESTORE') {
    set(entityType === 'product' ? 'status' : 'archived', entityType === 'product' ? 'draft' : false);
  } else if (operation.type === 'SET_FEATURED') {
    set('featured', true);
  } else if (operation.type === 'UNSET_FEATURED') {
    set('featured', false);
  } else if (['SET_PRICE', 'ADJUST_PRICE'].includes(operation.type)) {
    const result = priceChange(entity, operation);
    if (result.error) errors.push(result.error);
    else set('price', result.nextPrice);
  } else if (['SET_COMPARE_PRICE', 'CLEAR_COMPARE_PRICE'].includes(operation.type)) {
    const result = compareChange(entity, operation);
    if (result.error) errors.push(result.error);
    else set('compareAtPrice', result.nextCompareAtPrice);
  } else if (['SET_PROVIDER_MAPPING', 'CLEAR_PROVIDER_MAPPING'].includes(operation.type)) {
    const result = mappingChange({ variant: entity, product, operation, providerOffers });
    if (result.error) errors.push(result.error);
    else Object.entries(result).forEach(([field, value]) => set(field, value));
  } else if (operation.type === 'SET_FULFILLMENT_SOURCE') {
    const source = operation.source;
    if (!['hico_manual_qr', 'hico_physical_stock', 'manual_processing'].includes(source)) {
      errors.push(operationError('FULFILLMENT_SOURCE_INVALID', 'Nguồn fulfillment không hợp lệ.'));
    } else if (source === 'hico_manual_qr') {
      set('supplier', 'hico');
      set('medium', 'esim');
      set('fulfillmentMethod', 'HICO_MANUAL_QR');
      set('providerOfferId', undefined);
      set('wmproductId', undefined);
      set('providerProductId', undefined);
      set('providerProductType', null);
      set('leSIM', null);
      set('requiresExistingSim', false);
      set('active', false);
      set('needsReview', false);
    } else if (source === 'hico_physical_stock') {
      set('supplier', 'hico');
      set('fulfillmentMethod', 'HICO_PHYSICAL_STOCK');
      set('medium', 'physical_sim');
      set('providerOfferId', undefined);
      set('wmproductId', undefined);
      set('providerProductId', undefined);
      set('providerProductType', null);
      set('leSIM', null);
      set('requiresExistingSim', false);
      set('active', false);
      set('needsReview', false);
    } else {
      set('supplier', 'other');
      set('fulfillmentMethod', 'MANUAL_PROCESSING');
      set('providerOfferId', undefined);
      set('wmproductId', undefined);
      set('providerProductId', undefined);
      set('providerProductType', null);
      set('leSIM', null);
      set('requiresExistingSim', false);
      set('active', false);
      set('needsReview', true);
    }
  } else if (operation.type === 'RUN_READINESS') {
    const result = readiness({ entityType, entity, product, products, variants, providerOffers });
    errors.push(...readinessErrors(result));
    warnings.push(...result.warnings);
  }

  return {
    next,
    errors,
    warnings,
    changedFields: [...new Set(changedFields)],
  };
};
