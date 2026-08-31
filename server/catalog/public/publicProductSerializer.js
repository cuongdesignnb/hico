import { isPublicVariant } from '../../seo/seoVisibility.js';

const PUBLIC_DEVICE_FIELDS = [
  'brand',
  'model',
  'networkGeneration',
  'formFactor',
  'supportedBands',
  'wifiStandard',
  'maxConnectedDevices',
  'batteryCapacity',
  'ethernetPorts',
  'usbPorts',
  'simCompatibility',
  'dimensions',
  'weight',
  'color',
  'warrantyMonths',
];

const PUBLIC_CONTENT_FIELDS = [
  'networkLabel',
  'coverageLabel',
  'speedLabel',
  'hotspotSupport',
  'activationPolicy',
  'installationGuide',
  'compatibilityContent',
  'apnGuidance',
  'instantDeliveryLabel',
  'instructions',
  'eligibilityNote',
  'packageContents',
  'deliveryNote',
  'simSize',
];

const pickDefined = (source, fields) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined && source[field] !== null && source[field] !== '') {
      result[field] = source[field];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const pickDeviceSpecifications = (value) => pickDefined(value, PUBLIC_DEVICE_FIELDS);

const normalizeMedia = (product, mediaAssets = []) => {
  const assetsById = new Map(mediaAssets.filter((asset) => asset?.status !== 'ARCHIVED').map((asset) => [asset.id, asset]));
  const primaryAsset = product?.primaryMediaId ? assetsById.get(product.primaryMediaId) : undefined;
  const referencedAssets = Array.isArray(product?.galleryMediaIds)
    ? product.galleryMediaIds.map((id) => assetsById.get(id)).filter(Boolean)
    : [];
  const source = referencedAssets.length > 0
    ? referencedAssets
    : Array.isArray(product?.gallery) && product.gallery.length > 0
    ? product.gallery
    : Array.isArray(product?.images) ? product.images : [];
  const gallery = source.map((entry, index) => {
    const media = entry?.publicUrl ? { ...entry, url: entry.publicUrl, alt: entry.altText ?? entry.alt } : typeof entry === 'string' ? { url: entry } : entry;
    if (!media || typeof media.url !== 'string' || !/^\/(?:images|uploads)\//.test(media.url)) return null;
    return {
      id: typeof media.id === 'string' && media.id ? media.id : `media-${index + 1}`,
      url: media.url,
      alt: typeof media.alt === 'string' ? media.alt : product.name,
      ...(typeof media.title === 'string' && media.title ? { title: media.title } : {}),
      sortOrder: Number.isInteger(media.sortOrder) ? media.sortOrder : index,
    };
  }).filter(Boolean);
  const primary = primaryAsset?.publicUrl || (typeof product?.image === 'string' && /^\/(?:images|uploads)\//.test(product.image)
    ? product.image
    : gallery[0]?.url);
  const deduped = primary && !gallery.some((item) => item.url === primary)
    ? [{ id: 'primary', url: primary, alt: product.name, sortOrder: -1 }, ...gallery]
    : gallery;
  return {
    primary: primary ?? null,
    primaryAsset,
    gallery: deduped,
    urls: [...new Set(deduped.map((item) => item.url))],
  };
};

const optionalPublicFields = (source) => pickDefined(source, PUBLIC_CONTENT_FIELDS);

const providerPublicMetadata = (variant, providerOffers = []) => {
  const offer = providerOffers.find((item) => item.id === variant.providerOfferId);
  return {
    ...(offer?.apnHint ? { apn: offer.apnHint } : {}),
    ...(offer?.networkLabel ? { networkLabel: offer.networkLabel } : {}),
    ...(variant.publicNote ? { publicNote: variant.publicNote } : {}),
  };
};

export const toPublicVariant = (variant, { providerOffers = [] } = {}) => {
  if (!isPublicVariant(variant)) return null;
  const stock = Number.isInteger(variant.stock) && variant.stock >= 0 ? variant.stock : null;
  const content = optionalPublicFields(variant);
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? null,
    currency: variant.currency,
    active: true,
    dataLimit: variant.dataLimit ?? null,
    duration: variant.duration ?? null,
    medium: variant.medium ?? null,
    supplier: variant.supplier,
    fulfillmentMethod: variant.fulfillmentMethod,
    requiresExistingSim: variant.requiresExistingSim === true,
    shippingRequired: variant.shippingRequired === true || variant.medium === 'physical_sim',
    stock,
    availability: {
      inStock: stock === null || stock > 0,
      stockKnown: stock !== null,
    },
    ...(content ?? {}),
    ...providerPublicMetadata(variant, providerOffers),
    ...(pickDeviceSpecifications(variant.deviceSpecifications ?? variant.deviceSpecs ?? variant.specs)
      ? { deviceSpecifications: pickDeviceSpecifications(variant.deviceSpecifications ?? variant.deviceSpecs ?? variant.specs) }
      : {}),
  };
};

const summarizeVariants = (variants, options) => {
  const rows = variants.map((variant) => toPublicVariant(variant, options)).filter(Boolean);
  const selected = new Map();
  for (const variant of rows) {
    const key = `${variant.currency}:${variant.medium ?? 'product'}`;
    const current = selected.get(key);
    if (!current || variant.price < current.price) selected.set(key, variant);
  }
  return { rows: [...selected.values()], count: rows.length };
};

export const toPublicProduct = (product, variants = [], { includeVariants = true, mediaAssets = [], providerOffers = [] } = {}) => {
  const publicVariantRows = summarizeVariants(variants, { providerOffers });
  const media = normalizeMedia(product, mediaAssets);
  const content = optionalPublicFields(product);
  const deviceSpecifications = pickDeviceSpecifications(product.deviceSpecifications ?? product.deviceSpecs);
  const faqItems = Array.isArray(product.faqItems)
    ? product.faqItems
      .filter((item) => item && typeof item.question === 'string' && typeof item.answer === 'string')
      .map((item, index) => ({ question: item.question, answer: item.answer, sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index }))
    : [];
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    operation: product.operation,
    status: product.status,
    featured: product.featured === true,
    coverageType: product.coverageType,
    coverageIds: Array.isArray(product.coverageIds) ? [...product.coverageIds] : [],
    primaryImage: media.primary,
    ...(media.primaryAsset ? { primaryMedia: { id: media.primaryAsset.id, url: media.primaryAsset.publicUrl, alt: media.primaryAsset.altText || product.name, ...(media.primaryAsset.title ? { title: media.primaryAsset.title } : {}) } } : {}),
    image: media.primary ?? undefined,
    images: media.urls,
    gallery: media.gallery,
    description: product.description,
    guide: product.guide,
    ...(content ?? {}),
    ...(deviceSpecifications ? { deviceSpecifications, deviceSpecs: deviceSpecifications } : {}),
    faqItems,
    seo: {
      title: product.seoTitle,
      description: product.seoDescription,
      keywords: product.seoKeywords,
    },
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    seoKeywords: product.seoKeywords,
    ...(product.createdAt ? { createdAt: product.createdAt } : {}),
    ...(product.updatedAt ? { updatedAt: product.updatedAt } : {}),
    ...(product.publishedAt ? { publishedAt: product.publishedAt } : {}),
    variantCount: publicVariantRows.count,
    variants: includeVariants ? variants.map((variant) => toPublicVariant(variant, { providerOffers })).filter(Boolean) : publicVariantRows.rows,
  };
};

export const publicVariantsForProduct = (product, variants, { providerOffers = [] } = {}) => (
  variants
    .filter((variant) => variant.productId === product.id)
    .map((variant) => toPublicVariant(variant, { providerOffers }))
    .filter(Boolean)
);

export const PUBLIC_FORBIDDEN_KEYS = new Set([
  'providerOfferId',
  'wmproductId',
  'providerProductId',
  'providerToken',
  'apiKey',
  'secret',
  'password',
  'qr',
  'lpa',
  'pin',
  'puk',
  'redemptionCode',
  'rawInventoryMovements',
  'audit',
  'reconciliation',
]);
