import {
  categoryById,
  isLeafCategory,
  operationForCategoryKind,
  validateCategories,
} from '../categories/catalogCategories.js';
import { PUBLIC_SKU_PATTERN } from '../public/publicSku.js';

const PRODUCT_OPERATIONS = new Set([
  'new_subscription',
  'topup',
  'device_sale',
]);
const COVERAGE_TYPES = new Set([
  'country',
  'region',
  'global',
  'not_applicable',
]);
const CATALOG_STATUSES = new Set(['active', 'draft', 'archived']);
const CURRENCIES = new Set(['VND', 'USD']);
const MEDIUMS = new Set(['esim', 'physical_sim', null]);
const DATA_POLICIES = new Set(['daily', 'total']);
const PACKAGE_CLASSES = new Set(['STANDARD_TRAVEL', 'PRELOADED', 'VOICE', 'DOMESTIC_VN', 'UNKNOWN']);
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
const WORLDMOVE_METHODS = new Set([
  'WORLDMOVE_ESIM_REDEEM',
  'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  'WORLDMOVE_PHYSICAL_ORDER',
  'WORLDMOVE_TOPUP',
]);

const isNonEmptyString = (value) => (
  typeof value === 'string' && value.trim() !== ''
);
const isValidDate = (value) => (
  isNonEmptyString(value) && !Number.isNaN(Date.parse(value))
);
const isNonNegativeNumber = (value) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);
const findDuplicates = (values) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
};

const expectedWorldmoveMethod = (offer) => {
  if (offer?.providerProductType === 0 && offer.leSIM === true) {
    return 'WORLDMOVE_ESIM_REDEEM';
  }
  if (offer?.providerProductType === 0 && offer.leSIM === false) {
    return 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM';
  }
  if (offer?.providerProductType === 1) return 'WORLDMOVE_PHYSICAL_ORDER';
  if (offer?.providerProductType === 2) return 'WORLDMOVE_TOPUP';
  return undefined;
};

export class CanonicalCatalogValidationError extends Error {
  constructor(message, result) {
    super(message);
    this.name = 'CanonicalCatalogValidationError';
    this.result = result;
  }
}

export const validateCanonicalCatalog = ({
  products,
  variants,
  categories = [],
  providerOffers,
  manualQrs,
}) => {
  const errors = [];
  const warnings = [];
  const productList = Array.isArray(products) ? products : [];
  const variantList = Array.isArray(variants) ? variants : [];
  const categoryList = Array.isArray(categories) ? categories : [];
  const categoryValidation = validateCategories(categoryList);
  errors.push(...categoryValidation.errors);
  const duplicateProductIds = findDuplicates(productList.map((item) => item?.id));
  const duplicateVariantIds = findDuplicates(variantList.map((item) => item?.id));
  const duplicateSkus = findDuplicates(variantList.map((item) => item?.sku));
  const duplicatePublicSkus = findDuplicates(variantList.map((item) => item?.publicSku).filter(Boolean));
  const duplicateSkuSet = new Set(duplicateSkus);
  const duplicateSlugs = findDuplicates(productList.map((item) => item?.slug));
  const productIds = new Set(productList.map((item) => item?.id));
  const productsById = new Map(productList.map((item) => [item?.id, item]));
  const variantIds = new Set(variantList.map((item) => item?.id));
  const providerOfferList = providerOffers ?? [];
  const manualQrList = manualQrs ?? [];
  const validateProviderMappings = Array.isArray(providerOffers);
  const offersById = new Map(
    providerOfferList.map((offer) => [offer.id, offer]),
  );
  const offersByWorldmoveId = new Map();
  const blockedVariantIds = new Set();
  const blockedReasons = {};
  const blockPublish = (variantId, reason) => {
    blockedVariantIds.add(variantId);
    blockedReasons[reason] = (blockedReasons[reason] ?? 0) + 1;
  };

  for (const offer of providerOfferList) {
    const matches = offersByWorldmoveId.get(offer.wmproductId) ?? [];
    matches.push(offer);
    offersByWorldmoveId.set(offer.wmproductId, matches);
  }

  if (!Array.isArray(products)) errors.push('Canonical products must be an array.');
  if (!Array.isArray(variants)) errors.push('Canonical variants must be an array.');
  if (duplicateProductIds.length) errors.push('Duplicate canonical product IDs.');
  if (duplicateVariantIds.length) errors.push('Duplicate canonical variant IDs.');
  if (duplicateSlugs.length) errors.push('Duplicate canonical product slugs.');
  if (duplicateSkus.length) {
    warnings.push(
      `${duplicateSkus.length} duplicate legacy SKU values require review.`,
    );
  }
  if (duplicatePublicSkus.length) errors.push('Duplicate canonical public SKU values.');

  for (const product of productList) {
    const label = `Product ${product?.id ?? '<missing>'}`;
    if (!isNonEmptyString(product?.id)) errors.push(`${label} has invalid id.`);
    if (!isNonEmptyString(product?.slug)) errors.push(`${label} has invalid slug.`);
    if (!isNonEmptyString(product?.name)) errors.push(`${label} has invalid name.`);
    if (product?.dataPolicy !== undefined && !DATA_POLICIES.has(product.dataPolicy)) errors.push(`${label} has invalid dataPolicy.`);
    if (product?.packageClass !== undefined && !PACKAGE_CLASSES.has(product.packageClass)) errors.push(`${label} has invalid packageClass.`);
    if (!PRODUCT_OPERATIONS.has(product?.operation)) {
      errors.push(`${label} has invalid operation.`);
    }
    if (!COVERAGE_TYPES.has(product?.coverageType)) {
      errors.push(`${label} has invalid coverageType.`);
    }
    if (
      !Array.isArray(product?.coverageIds)
      || product.coverageIds.some((id) => !isNonEmptyString(id))
    ) {
      errors.push(`${label} has invalid coverageIds.`);
    }
    if (!CATALOG_STATUSES.has(product?.status)) {
      errors.push(`${label} has invalid status.`);
    }
    if (product?.categoryId) {
      const category = categoryById(categoryList, product.categoryId);
      if (!category || !isLeafCategory(category, categoryList)) {
        errors.push(`${label} references an invalid leaf category.`);
      } else if (operationForCategoryKind(category.kind) !== product.operation) {
        errors.push(`${label} operation does not match its category kind.`);
      }
    } else {
      warnings.push(`${label} requires category review.`);
    }
    if (!Number.isInteger(product?.version) || product.version < 1) {
      errors.push(`${label} has invalid version.`);
    }
    if (!isValidDate(product?.createdAt) || !isValidDate(product?.updatedAt)) {
      errors.push(`${label} has invalid timestamps.`);
    }
  }

  const orphanVariants = [];
  for (const variant of variantList) {
    const label = `Variant ${variant?.id ?? '<missing>'}`;
    if (variant?.operationResolution === 'UNRESOLVED') blockPublish(variant.id, 'operationUnresolved');
    if (variant?.needsReview) blockPublish(variant.id, 'needsReview');
    if (duplicateSkuSet.has(variant?.sku)) {
      blockPublish(variant.id, 'duplicateSku');
    }
    if (!isNonEmptyString(variant?.id)) errors.push(`${label} has invalid id.`);
    if (!isNonEmptyString(variant?.sku)) errors.push(`${label} has invalid sku.`);
    if (variant?.publicSku !== undefined && !PUBLIC_SKU_PATTERN.test(variant.publicSku)) {
      errors.push(`${label} has invalid publicSku.`);
    }
    if (!productIds.has(variant?.productId)) {
      orphanVariants.push(variant?.id);
      errors.push(`${label} references a missing product.`);
    }
    const variantProduct = productsById.get(variant?.productId);
    const variantCategory = categoryById(categoryList, variantProduct?.categoryId);
    if (variantCategory && variant?.fulfillmentMethod !== 'MANUAL_PROCESSING') {
      if (variantCategory.kind === 'esim' && variant.medium !== 'esim') {
        errors.push(`${label} medium does not match its eSIM category.`);
      }
      if (['physical_sim', 'device', 'accessory'].includes(variantCategory.kind) && variant.medium !== 'physical_sim') {
        errors.push(`${label} medium does not match its physical category.`);
      }
      if (variantCategory.kind === 'topup' && variant.fulfillmentMethod !== 'WORLDMOVE_TOPUP') {
        errors.push(`${label} fulfillment does not match its top-up category.`);
      }
    }
    if (!isNonNegativeNumber(variant?.price)) {
      errors.push(`${label} has invalid price.`);
    }
    if (variant?.tripDayOptions !== undefined && (!Array.isArray(variant.tripDayOptions) || variant.tripDayOptions.some((value) => !Number.isInteger(value) || value < 1))) {
      errors.push(`${label} has invalid tripDayOptions.`);
    }
    if (variant?.durationValue !== undefined && (!Number.isInteger(variant.durationValue) || variant.durationValue < 1 || variant.durationValue > 3650)) errors.push(`${label} has invalid durationValue.`);
    if (variant?.durationUnit !== undefined && !['day', 'month'].includes(variant.durationUnit)) errors.push(`${label} has invalid durationUnit.`);
    if (variant?.cancellable !== undefined && typeof variant.cancellable !== 'boolean') errors.push(`${label} has invalid cancellable.`);
    if (
      variant?.compareAtPrice !== null
      && variant?.compareAtPrice !== undefined
      && !isNonNegativeNumber(variant.compareAtPrice)
    ) {
      errors.push(`${label} has invalid compareAtPrice.`);
    }
    if (!CURRENCIES.has(variant?.currency)) {
      errors.push(`${label} has invalid currency.`);
      blockPublish(variant.id, 'invalidCurrency');
    }
    if (!MEDIUMS.has(variant?.medium)) errors.push(`${label} has invalid medium.`);
    if (!SUPPLIERS.has(variant?.supplier)) {
      errors.push(`${label} has invalid supplier.`);
    }
    if (!FULFILLMENT_METHODS.has(variant?.fulfillmentMethod)) {
      errors.push(`${label} has invalid fulfillmentMethod.`);
      blockPublish(variant.id, 'missingFulfillment');
    }
    if (!Number.isInteger(variant?.version) || variant.version < 1) {
      errors.push(`${label} has invalid version.`);
    }
    if (!isValidDate(variant?.createdAt) || !isValidDate(variant?.updatedAt)) {
      errors.push(`${label} has invalid timestamps.`);
    }
    if (
      variant?.stock !== null
      && variant?.stock !== undefined
      && (!Number.isInteger(variant.stock) || variant.stock < 0)
    ) {
      errors.push(`${label} has invalid stock.`);
    }
    if (variant?.fulfillmentMethod === 'HICO_PHYSICAL_STOCK') {
      if (variant.medium !== 'physical_sim') {
        errors.push(`${label} has invalid physical stock medium.`);
      }
    } else if (
      variant?.fulfillmentMethod === 'HICO_MANUAL_QR'
      && variant.medium !== 'esim'
    ) {
      errors.push(`${label} has invalid manual QR medium.`);
      blockPublish(variant.id, 'invalidManualQrMapping');
    } else if (variant?.medium === 'physical_sim' && !variant?.needsReview) {
      if (
        variant.fulfillmentMethod !== 'WORLDMOVE_PHYSICAL_ORDER'
        && variant.fulfillmentMethod !== 'WORLDMOVE_TOPUP'
      ) {
        errors.push(`${label} has invalid physical fulfillment.`);
      }
    } else if (variant?.medium === 'esim' && (
      variant.fulfillmentMethod === 'WORLDMOVE_PHYSICAL_ORDER'
      || variant.fulfillmentMethod === 'HICO_PHYSICAL_STOCK'
    )) {
      errors.push(`${label} has invalid eSIM fulfillment.`);
    }
    if (
      variant?.fulfillmentMethod === 'WORLDMOVE_TOPUP'
      && variant.requiresExistingSim !== true
    ) {
      errors.push(`${label} top-up must require an existing SIM.`);
    }
    if (
      validateProviderMappings
      && WORLDMOVE_METHODS.has(variant?.fulfillmentMethod)
    ) {
      const offer = offersById.get(variant.providerOfferId);
      const sameWorldmoveIdOffers = offersByWorldmoveId.get(variant.wmproductId) ?? [];
      if (!offer) errors.push(`${label} references a missing provider offer.`);
      else {
        if (!offer.active) {
          errors.push(`${label} references an inactive provider offer.`);
          blockPublish(variant.id, 'inactiveProvider');
        }
        if (offer.wmproductId !== variant.wmproductId) {
          errors.push(`${label} has a mismatched provider offer.`);
          blockPublish(variant.id, 'providerConflict');
        }
        if (expectedWorldmoveMethod(offer) !== variant.fulfillmentMethod) {
          errors.push(`${label} has incompatible provider metadata.`);
          blockPublish(variant.id, 'providerConflict');
        }
      }
      if (sameWorldmoveIdOffers.length > 1) {
        errors.push(`${label} wmproductId maps to multiple provider offers.`);
        blockPublish(variant.id, 'providerConflict');
      }
    }
  }

  const orphanManualQrs = [];
  const manualQrIds = new Set();
  for (const qr of manualQrList) {
    if (manualQrIds.has(qr?.id)) {
      errors.push(`Manual QR ${qr?.id ?? '<missing>'} is duplicated.`);
    }
    manualQrIds.add(qr?.id);
    if (!variantIds.has(qr?.variantId)) {
      orphanManualQrs.push(qr?.id ?? '<missing>');
    }
  }
  if (orphanManualQrs.length) {
    warnings.push(`${orphanManualQrs.length} manual QR records are orphaned.`);
  }

  const result = {
    valid: errors.length === 0,
    errors,
    warnings,
    duplicateProductIds,
    duplicateVariantIds,
    duplicateSkus,
    duplicateSlugs,
    orphanVariants: orphanVariants.sort(),
    orphanManualQrs: orphanManualQrs.sort(),
    publishSafety: {
      totalVariants: variantList.length,
      publishableVariants: variantList.length - blockedVariantIds.size,
      blockedVariants: blockedVariantIds.size,
      blockedReasons,
    },
  };

  return result;
};

export const assertCanonicalCatalog = (context) => {
  const result = validateCanonicalCatalog(context);
  if (!result.valid) {
    throw new CanonicalCatalogValidationError(
      `Canonical catalog validation failed with ${result.errors.length} error(s).`,
      result,
    );
  }
  return result;
};
