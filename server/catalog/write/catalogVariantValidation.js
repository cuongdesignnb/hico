import {
  CatalogWriteError,
  requireNonEmptyString,
  requireObject,
} from './catalogWriteValidation.js';
import {
  normalizeDeviceSpecifications,
  normalizePublicContent,
  PUBLIC_CONTENT_FIELDS,
} from './catalogContractFields.js';

const CURRENCIES = new Set(['VND', 'USD']);
const MEDIUMS = new Set(['esim', 'physical_sim', null]);
const SUPPLIERS = new Set(['worldmove', 'local_carrier', 'hico', 'other']);
const FULFILLMENT_METHODS = new Set([
  'WORLDMOVE_ESIM_REDEEM',
  'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  'WORLDMOVE_PHYSICAL_ORDER',
  'WORLDMOVE_TOPUP',
  'HICO_MANUAL_QR',
  'HICO_PHYSICAL_STOCK',
  'EXTERNAL_PROVIDER_API',
  'MANUAL_PROCESSING',
]);
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const VARIANT_FIELDS = new Set([
  'id',
  'sku',
  'dataLimit',
  'duration',
  'price',
  'compareAtPrice',
  'currency',
  'medium',
  'supplier',
  'fulfillmentMethod',
  'providerOfferId',
  'wmproductId',
  'providerProductId',
  'providerProductType',
  'leSIM',
  'requiresExistingSim',
  'shippingRequired',
  'deviceSpecifications',
  'stock',
  'active',
  'needsReview',
  ...PUBLIC_CONTENT_FIELDS,
]);

const optionalString = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new CatalogWriteError(`${fieldName} phải là chuỗi.`);
  }
  return value.trim();
};

const nonNegativeNumber = (value, fieldName, { nullable = false } = {}) => {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new CatalogWriteError(`${fieldName} phải là số hữu hạn không âm.`);
  }
  return value;
};

export const normalizeVariantInput = (input, { partial = false } = {}) => {
  requireObject(input, 'variant');
  const unknownFields = Object.keys(input).filter((key) => !VARIANT_FIELDS.has(key));
  if (unknownFields.length) {
    throw new CatalogWriteError(
      `Variant chứa field không được hỗ trợ: ${unknownFields.join(', ')}.`,
    );
  }

  const result = {};
  if (input.id !== undefined) {
    const id = requireNonEmptyString(input.id, 'variant.id');
    if (!ID_PATTERN.test(id)) throw new CatalogWriteError('variant.id không hợp lệ.');
    result.id = id;
  }
  if (!partial || input.sku !== undefined) {
    result.sku = requireNonEmptyString(input.sku, 'variant.sku');
    if (result.sku.length > 160) throw new CatalogWriteError('variant.sku quá dài.');
  }
  for (const field of ['dataLimit', 'duration']) {
    if (input[field] !== undefined) {
      result[field] = optionalString(input[field], `variant.${field}`);
    }
  }
  if (!partial || input.price !== undefined) {
    result.price = nonNegativeNumber(input.price, 'variant.price');
  }
  if (input.compareAtPrice !== undefined) {
    result.compareAtPrice = nonNegativeNumber(
      input.compareAtPrice,
      'variant.compareAtPrice',
      { nullable: true },
    );
  }
  if (!partial || input.currency !== undefined) {
    if (!CURRENCIES.has(input.currency)) {
      throw new CatalogWriteError('currency chỉ hỗ trợ VND hoặc USD.');
    }
    result.currency = input.currency;
  }
  if (!partial || input.medium !== undefined) {
    if (!MEDIUMS.has(input.medium)) {
      throw new CatalogWriteError('medium không hợp lệ.');
    }
    result.medium = input.medium;
  }
  if (!partial || input.supplier !== undefined) {
    if (!SUPPLIERS.has(input.supplier)) {
      throw new CatalogWriteError('supplier không hợp lệ.');
    }
    result.supplier = input.supplier;
  }
  if (!partial || input.fulfillmentMethod !== undefined) {
    if (!FULFILLMENT_METHODS.has(input.fulfillmentMethod)) {
      throw new CatalogWriteError('fulfillmentMethod không hợp lệ.');
    }
    result.fulfillmentMethod = input.fulfillmentMethod;
  }
  for (const field of ['providerOfferId', 'wmproductId', 'providerProductId']) {
    if (input[field] !== undefined) {
      result[field] = optionalString(input[field], `variant.${field}`);
    }
  }
  if (input.providerProductType !== undefined) {
    if (
      input.providerProductType !== null
      && ![0, 1, 2].includes(input.providerProductType)
    ) {
      throw new CatalogWriteError('providerProductType không hợp lệ.');
    }
    result.providerProductType = input.providerProductType;
  }
  if (input.leSIM !== undefined) {
    if (input.leSIM !== null && typeof input.leSIM !== 'boolean') {
      throw new CatalogWriteError('leSIM phải là boolean hoặc null.');
    }
    result.leSIM = input.leSIM;
  }
  for (const field of ['requiresExistingSim', 'active', 'needsReview']) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== 'boolean') {
        throw new CatalogWriteError(`${field} phải là boolean.`);
      }
      result[field] = input[field];
    }
  }
  if (input.shippingRequired !== undefined) {
    if (typeof input.shippingRequired !== 'boolean') throw new CatalogWriteError('shippingRequired phải là boolean.');
    result.shippingRequired = input.shippingRequired;
  }
  Object.assign(result, normalizePublicContent(input, 'variant'));
  if (input.deviceSpecifications !== undefined) {
    result.deviceSpecifications = normalizeDeviceSpecifications(input.deviceSpecifications, 'variant.deviceSpecifications');
  }
  if (input.stock !== undefined) {
    if (
      input.stock !== null
      && (!Number.isInteger(input.stock) || input.stock < 0)
    ) {
      throw new CatalogWriteError('stock phải là số nguyên không âm hoặc null.');
    }
    result.stock = input.stock;
  }
  return result;
};

const providerError = (code, message) => ({ code, message });

const validateProviderOffer = (variant, offersById, expected) => {
  const errors = [];
  const offer = offersById.get(variant.providerOfferId);
  if (!offer) {
    errors.push(providerError(
      'PROVIDER_OFFER_NOT_FOUND',
      'Provider offer không tồn tại.',
    ));
    return errors;
  }
  if (!offer.active) {
    errors.push(providerError(
      'PROVIDER_OFFER_INACTIVE',
      'Provider offer đang không hoạt động.',
    ));
  }
  if (offer.wmproductId !== variant.wmproductId) {
    errors.push(providerError(
      'PROVIDER_MAPPING_CONFLICT',
      'wmproductId không khớp provider offer.',
    ));
  }
  if (offer.providerProductType !== expected.providerProductType) {
    errors.push(providerError(
      'PROVIDER_TYPE_CONFLICT',
      'providerProductType không khớp provider offer.',
    ));
  }
  if (expected.leSIM !== undefined && offer.leSIM !== expected.leSIM) {
    errors.push(providerError(
      'PROVIDER_LESIM_CONFLICT',
      'Loại leSIM không khớp provider offer.',
    ));
  }
  return errors;
};

export const validateVariantRecord = ({
  variant,
  product,
  providerOffers = [],
}) => {
  const errors = [];
  const warnings = [];
  try {
    normalizeVariantInput({
      id: variant.id,
      sku: variant.sku,
      dataLimit: variant.dataLimit,
      duration: variant.duration,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      currency: variant.currency,
      medium: variant.medium,
      supplier: variant.supplier,
      fulfillmentMethod: variant.fulfillmentMethod,
      providerOfferId: variant.providerOfferId,
      wmproductId: variant.wmproductId,
      providerProductId: variant.providerProductId,
      providerProductType: variant.providerProductType,
      leSIM: variant.leSIM,
      requiresExistingSim: variant.requiresExistingSim,
      shippingRequired: variant.shippingRequired,
      deviceSpecifications: variant.deviceSpecifications ?? variant.deviceSpecs,
      ...Object.fromEntries(PUBLIC_CONTENT_FIELDS.map((field) => [field, variant[field]])),
      stock: variant.stock,
      active: variant.active,
      needsReview: variant.needsReview,
    });
  } catch (error) {
    errors.push({ code: 'INVALID_VARIANT', message: error.message });
  }

  if (!product || variant.productId !== product.id) {
    errors.push({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Variant không thuộc product hợp lệ.',
    });
  }
  if (!Number.isInteger(variant.version) || variant.version < 1) {
    errors.push({ code: 'INVALID_VERSION', message: 'version không hợp lệ.' });
  }
  for (const field of ['createdAt', 'updatedAt']) {
    if (
      typeof variant[field] !== 'string'
      || Number.isNaN(Date.parse(variant[field]))
    ) {
      errors.push({
        code: 'INVALID_TIMESTAMP',
        message: `${field} không hợp lệ.`,
      });
    }
  }
  if (
    variant.compareAtPrice !== null
    && variant.compareAtPrice !== undefined
    && variant.compareAtPrice < variant.price
  ) {
    warnings.push({
      code: 'COMPARE_PRICE_BELOW_PRICE',
      message: 'compareAtPrice đang nhỏ hơn price.',
    });
  }

  const offersById = new Map(providerOffers.map((offer) => [offer.id, offer]));
  switch (variant.fulfillmentMethod) {
    case 'WORLDMOVE_ESIM_REDEEM':
      if (
        variant.medium !== 'esim'
        || variant.supplier !== 'worldmove'
        || variant.providerProductType !== 0
        || variant.leSIM !== true
      ) {
        errors.push(providerError(
          'INVALID_WORLDMOVE_LESIM',
          'Cấu hình Worldmove leSIM không hợp lệ.',
        ));
      }
      errors.push(...validateProviderOffer(variant, offersById, {
        providerProductType: 0,
        leSIM: true,
      }));
      break;
    case 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM':
      if (
        variant.medium !== 'esim'
        || variant.supplier !== 'local_carrier'
        || variant.providerProductType !== 0
        || variant.leSIM !== false
      ) {
        errors.push(providerError(
          'INVALID_LOCAL_CARRIER_ESIM',
          'Cấu hình eSIM local carrier không hợp lệ.',
        ));
      }
      errors.push(...validateProviderOffer(variant, offersById, {
        providerProductType: 0,
        leSIM: false,
      }));
      break;
    case 'WORLDMOVE_PHYSICAL_ORDER':
      if (
        variant.medium !== 'physical_sim'
        || variant.supplier !== 'worldmove'
        || variant.providerProductType !== 1
      ) {
        errors.push(providerError(
          'INVALID_WORLDMOVE_PHYSICAL',
          'Cấu hình Worldmove physical SIM không hợp lệ.',
        ));
      }
      errors.push(...validateProviderOffer(variant, offersById, {
        providerProductType: 1,
      }));
      break;
    case 'WORLDMOVE_TOPUP':
      if (
        product?.operation !== 'topup'
        || variant.medium !== null
        || variant.supplier !== 'worldmove'
        || variant.providerProductType !== 2
        || variant.requiresExistingSim !== true
      ) {
        errors.push(providerError(
          'INVALID_WORLDMOVE_TOPUP',
          'Cấu hình Worldmove top-up không hợp lệ.',
        ));
      }
      errors.push(...validateProviderOffer(variant, offersById, {
        providerProductType: 2,
      }));
      break;
    case 'HICO_MANUAL_QR':
      if (
        variant.medium !== 'esim'
        || variant.supplier !== 'hico'
        || variant.requiresExistingSim !== false
      ) {
        errors.push(providerError(
          'INVALID_MANUAL_QR',
          'Cấu hình HICO manual QR không hợp lệ.',
        ));
      }
      break;
    case 'HICO_PHYSICAL_STOCK':
      if (
        variant.medium !== 'physical_sim'
        || variant.supplier !== 'hico'
        || variant.requiresExistingSim !== false
        || !Number.isInteger(variant.stock)
        || variant.stock < 0
      ) {
        errors.push(providerError(
          'INVALID_HICO_PHYSICAL_STOCK',
          'Cấu hình kho SIM vật lý HICO không hợp lệ.',
        ));
      }
      break;
    case 'MANUAL_PROCESSING':
      if (variant.active !== false || variant.needsReview !== true) {
        errors.push(providerError(
          'INVALID_MANUAL_PROCESSING',
          'Manual processing phải inactive và needsReview.',
        ));
      }
      break;
    default:
      errors.push(providerError(
        'UNSUPPORTED_FULFILLMENT',
        'Fulfillment chưa đủ điều kiện canonical write.',
      ));
  }

  return { valid: errors.length === 0, errors, warnings };
};

