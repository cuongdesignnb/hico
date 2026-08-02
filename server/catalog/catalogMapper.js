import { applySkuConflictMetadata } from './canonical/canonicalSkuConflicts.js';

const DEFAULT_CURRENCY = 'VND';

const ensureString = (value, fieldName) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Legacy catalog item is missing ${fieldName}`);
  }

  return value;
};

const optionalString = (value) => (
  typeof value === 'string' && value.trim() !== '' ? value : undefined
);

const optionalNumber = (value) => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const pickOwnFields = (source, fields) => Object.fromEntries(
  fields
    .filter((field) => Object.hasOwn(source, field))
    .map((field) => [field, source[field]]),
);

const LEGACY_PRODUCT_FIELDS = [
  'id',
  'sku',
  'name',
  'flag',
  'coverage',
  'dataLimit',
  'duration',
  'price',
  'compareAtPrice',
  'wmproductId',
  'image',
  'network',
  'description',
  'guide',
  'featured',
  'iconType',
  'leSIM',
  'seoTitle',
  'seoDescription',
  'seoKeywords',
];

const LEGACY_VARIANT_FIELDS = [
  'id',
  'sku',
  'dataLimit',
  'duration',
  'price',
  'compareAtPrice',
  'wmproductId',
  'simType',
  'leSIM',
  'active',
  'currency',
];

const PRODUCT_OPERATIONS = new Set([
  'new_subscription',
  'topup',
  'device_sale',
]);

const resolveFulfillment = (variant) => {
  switch (variant.simType) {
    case 'leSIM':
      return {
        medium: 'esim',
        supplier: 'worldmove',
        fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM',
        providerProductType: 0,
        leSIM: true,
        needsReview: false,
      };
    case 'manual':
      return {
        medium: 'esim',
        supplier: 'hico',
        fulfillmentMethod: 'HICO_MANUAL_QR',
        providerProductType: null,
        leSIM: null,
        needsReview: false,
      };
    case 'physical':
      return {
        medium: 'physical_sim',
        supplier: 'hico',
        fulfillmentMethod: 'HICO_PHYSICAL_STOCK',
        providerProductType: null,
        leSIM: null,
        needsReview: false,
      };
    default:
      return {
        medium: 'esim',
        supplier: 'other',
        fulfillmentMethod: 'MANUAL_PROCESSING',
        providerProductType: null,
        leSIM: typeof variant.leSIM === 'boolean' ? variant.leSIM : null,
        needsReview: true,
      };
  }
};

export const mapLegacyVariant = (variant, productId, legacySource) => {
  const fulfillment = resolveFulfillment(variant);

  return {
    id: ensureString(variant.id, 'variant.id'),
    productId,
    sku: ensureString(variant.sku, 'variant.sku'),
    dataLimit: optionalString(variant.dataLimit),
    duration: optionalString(variant.duration),
    price: optionalNumber(variant.price) ?? 0,
    compareAtPrice: optionalNumber(variant.compareAtPrice),
    currency: variant.currency === 'USD' ? 'USD' : DEFAULT_CURRENCY,
    medium: fulfillment.medium,
    supplier: fulfillment.supplier,
    fulfillmentMethod: fulfillment.fulfillmentMethod,
    providerOfferId: optionalString(variant.providerOfferId),
    wmproductId: optionalString(variant.wmproductId),
    providerProductId: optionalString(variant.providerProductId),
    leSIM: fulfillment.leSIM,
    providerProductType: fulfillment.providerProductType,
    requiresExistingSim: false,
    stock: optionalNumber(variant.stock),
    active: variant.active !== false,
    needsReview: fulfillment.needsReview,
    legacySimType: optionalString(variant.simType),
    legacyProjection: pickOwnFields(variant, LEGACY_VARIANT_FIELDS),
    legacySource,
    legacyId: variant.id,
  };
};

const mapLegacyProduct = (legacyProduct, legacySource) => {
  const id = ensureString(legacyProduct.id, 'product.id');
  const iconType = legacyProduct.iconType;
  const coverageType = legacySource === 'destination'
    ? 'country'
    : iconType === 'global'
      ? 'global'
      : 'region';

  const product = {
    id,
    slug: optionalString(legacyProduct.slug) ?? id,
    name: ensureString(legacyProduct.name, 'product.name'),
    operation: PRODUCT_OPERATIONS.has(legacyProduct.operation)
      ? legacyProduct.operation
      : 'new_subscription',
    coverageType,
    coverageIds: coverageType === 'global' ? [] : [id],
    image: optionalString(legacyProduct.image),
    description: optionalString(legacyProduct.description),
    guide: optionalString(legacyProduct.guide),
    featured: Boolean(legacyProduct.featured),
    status: legacyProduct.status === 'draft' || legacyProduct.status === 'archived'
      ? legacyProduct.status
      : 'active',
    seoTitle: optionalString(legacyProduct.seoTitle),
    seoDescription: optionalString(legacyProduct.seoDescription),
    seoKeywords: optionalString(legacyProduct.seoKeywords),
    legacyProjection: pickOwnFields(legacyProduct, LEGACY_PRODUCT_FIELDS),
    legacySource,
    legacyId: id,
  };

  const variants = Array.isArray(legacyProduct.variants)
    ? legacyProduct.variants.map((variant) => mapLegacyVariant(variant, id, legacySource))
    : [];

  return { product, variants };
};

export const mapLegacyCatalog = ({ destinations, packages }) => {
  if (!Array.isArray(destinations) || !Array.isArray(packages)) {
    throw new Error('Legacy catalog sources must be arrays');
  }

  const mappedItems = [
    ...destinations.map((destination) => mapLegacyProduct(destination, 'destination')),
    ...packages.map((legacyPackage) => mapLegacyProduct(legacyPackage, 'package')),
  ];

  return {
    products: mappedItems.map((item) => item.product),
    variants: applySkuConflictMetadata(
      mappedItems.flatMap((item) => item.variants),
    ),
  };
};
