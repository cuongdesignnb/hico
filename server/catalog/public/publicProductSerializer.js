import { isPublicVariant } from '../../seo/seoVisibility.js';

// PDP feature card fields only
const PUBLIC_CONTENT_FIELDS = ['networkLabel', 'activationPolicy', 'hotspotSupport'];

const pickPublicFields = (source) => {
  if (!source || typeof source !== 'object') return undefined;
  const result = {};
  for (const field of PUBLIC_CONTENT_FIELDS) {
    if (source[field] !== undefined && source[field] !== null && source[field] !== '') {
      result[field] = source[field];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

export const toPublicVariant = (variant) => {
  if (!isPublicVariant(variant)) return null;
  const stock = Number.isInteger(variant.stock) && variant.stock >= 0 ? variant.stock : null;
  const content = pickPublicFields(variant);
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
  };
};

export const toPublicProduct = (product, variants = []) => {
  const publicVariants = variants
    .filter((v) => v.productId === product.id)
    .map(toPublicVariant)
    .filter(Boolean);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    operation: product.operation,
    status: product.status,
    featured: product.featured === true,
    coverageType: product.coverageType,
    coverageIds: Array.isArray(product.coverageIds) ? [...product.coverageIds] : [],
    image: product.image,
    images: Array.isArray(product.images) ? product.images : [],
    description: product.description,
    guide: product.guide,
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
    variantCount: publicVariants.length,
    variants: publicVariants,
  };
};
