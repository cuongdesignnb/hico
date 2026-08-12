import { mapLegacyCatalog } from './catalogMapper.js';
import {
  createCanonicalCatalogReader,
} from './canonical/canonicalCatalogReader.js';
import { getSeoVisibility } from '../seo/seoVisibility.js';
import { publicVariantsForProduct, toPublicProduct } from './publicCatalogProjection.js';
import { createProviderOfferRepository } from '../providers/providerOfferRepository.js';

const attachVariants = ({ products, variants }) => {
  const variantsByProduct = new Map();

  for (const variant of variants) {
    const productVariants = variantsByProduct.get(variant.productId) ?? [];
    productVariants.push(variant);
    variantsByProduct.set(variant.productId, productVariants);
  }

  return products.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) ?? [],
}));
};

const versionIdFor = (manifest) => manifest?.versionId ?? manifest?.migrationId ?? null;

const toAdminVariantSummary = (variant) => ({
  id: variant.id,
  productId: variant.productId,
  sku: variant.sku,
  wmproductId: variant.wmproductId ?? null,
  price: variant.price,
  compareAtPrice: variant.compareAtPrice ?? null,
  currency: variant.currency,
  medium: variant.medium ?? null,
  supplier: variant.supplier,
  fulfillmentMethod: variant.fulfillmentMethod,
  active: variant.active !== false,
  needsReview: variant.needsReview === true,
  archived: variant.archived === true,
  stock: Number.isInteger(variant.stock) ? variant.stock : null,
});

const toAdminProductSummary = (product) => {
  const summaries = product.variants.map(toAdminVariantSummary);
  const selected = new Map();
  for (const variant of summaries) {
    const key = `${variant.currency}:${variant.medium ?? ''}`;
    const current = selected.get(key);
    if (!current || variant.price < current.price) selected.set(key, variant);
  }
  return {
  id: product.id,
  slug: product.slug,
  name: product.name,
  operation: product.operation,
  coverageType: product.coverageType,
  coverageIds: Array.isArray(product.coverageIds) ? [...product.coverageIds] : [],
  image: product.image ?? null,
  featured: product.featured === true,
  status: product.status,
  variantCount: product.variants.length,
  needsReviewCount: product.variants.filter((variant) => variant.needsReview).length,
  variantIds: product.variants.map((variant) => variant.id),
  variants: [...selected.values()],
  };
};

const matchesAdminFilters = (product, filters) => {
  const normalizedSearch = typeof filters.search === 'string'
    ? filters.search.trim().toLocaleLowerCase('vi-VN')
    : '';
  if (filters.operation && product.operation !== filters.operation) return false;
  if (filters.coverage && product.coverageType !== filters.coverage) return false;
  if (filters.medium && !product.variants.some((variant) => variant.medium === filters.medium)) return false;
  if (filters.supplier && !product.variants.some((variant) => variant.supplier === filters.supplier)) return false;
  if (normalizedSearch) {
    const haystack = [
      product.name,
      product.id,
      product.slug,
      ...product.variants.flatMap((variant) => [variant.sku, variant.wmproductId]),
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN');
    if (!haystack.includes(normalizedSearch)) return false;
  }
  return true;
};

export const createCatalogService = (
  reader = createCanonicalCatalogReader(),
  { mediaAssetRepository = null, providerRepository = createProviderOfferRepository() } = {},
) => {
  const publicMediaAssets = async () => mediaAssetRepository?.list?.() ?? [];
  const publicProviderOffers = async () => providerRepository?.listOffers?.() ?? [];
  let cachedModel = null;
  let cachedVersion = null;
  const readModel = async () => {
    const catalog = typeof reader.readCatalog === 'function'
      ? await reader.readCatalog()
      : mapLegacyCatalog(await reader.readLegacyCatalog());
    const version = versionIdFor(catalog.manifest);
    if (!cachedModel || version === null || cachedVersion !== version) {
      cachedModel = attachVariants(catalog);
      cachedVersion = version;
    }
    return { products: cachedModel, versionId: version };
  };

  return {
    async listAdminProducts({ filters = {}, paginate = false } = {}) {
      const { products, versionId } = await readModel();
      if (!paginate) return products;
      const filtered = products.filter((product) => matchesAdminFilters(product, filters));
      const page = Math.max(1, Number.parseInt(filters.page ?? '1', 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(filters.pageSize ?? '20', 10) || 20));
      const start = (page - 1) * pageSize;
      return {
        items: filtered.slice(start, start + pageSize).map(toAdminProductSummary),
        pagination: {
          page,
          pageSize,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
        },
        summary: {
          products: products.length,
          variants: products.reduce((total, product) => total + product.variants.length, 0),
          needsReview: products.reduce((total, product) => total + product.variants.filter((variant) => variant.needsReview).length, 0),
        },
        catalogVersionId: versionId,
      };
    },

    async listPublicProducts({ filters = {}, paginate = false } = {}) {
      const { products } = await readModel();
      const [mediaAssets, providerOffers] = await Promise.all([publicMediaAssets(), publicProviderOffers()]);
      const publicProducts = products
        .filter((product) => getSeoVisibility(product, product.variants).public)
        .map((product) => toPublicProduct(product, product.variants, { includeVariants: false, mediaAssets, providerOffers }));
      const normalizedSearch = typeof filters.search === 'string' ? filters.search.trim().toLocaleLowerCase('vi-VN') : '';
      const filtered = publicProducts.filter((product) => {
        if (filters.operation && product.operation !== filters.operation) return false;
        if (filters.medium && !product.variants.some((variant) => variant.medium === filters.medium)) return false;
        if (filters.supplier && !product.variants.some((variant) => variant.supplier === filters.supplier)) return false;
        if (filters.currency && !product.variants.some((variant) => variant.currency === filters.currency)) return false;
        if (filters.coverage && !product.coverageIds.includes(filters.coverage)) return false;
        if (filters.inStock === true && !product.variants.some((variant) => variant.availability.inStock)) return false;
        if (filters.deviceGeneration && !product.variants.some((variant) => variant.deviceSpecs?.networkGeneration === filters.deviceGeneration)) return false;
        if (normalizedSearch) {
          const haystack = [product.name, product.slug, product.description, product.guide, ...product.variants.map((variant) => `${variant.sku} ${variant.dataLimit ?? ''} ${variant.duration ?? ''}`)]
            .filter(Boolean).join(' ').toLocaleLowerCase('vi-VN');
          if (!haystack.includes(normalizedSearch)) return false;
        }
        return true;
      });
      const sorted = [...filtered].sort((left, right) => {
        if (filters.sort === 'price_desc' || filters.sort === 'price_asc') {
          const price = (product) => Math.min(...product.variants.map((variant) => variant.price));
          return filters.sort === 'price_desc' ? price(right) - price(left) : price(left) - price(right);
        }
        if (filters.sort === 'name') return left.name.localeCompare(right.name, 'vi');
        if (filters.sort === 'featured') return Number(right.featured) - Number(left.featured);
        return left.name.localeCompare(right.name, 'vi');
      });
      if (!paginate) return sorted;
      const page = Math.max(1, Number.parseInt(filters.page ?? '1', 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(filters.pageSize ?? '24', 10) || 24));
      const start = (page - 1) * pageSize;
      return {
        items: sorted.slice(start, start + pageSize),
        pagination: { page, pageSize, total: sorted.length, totalPages: Math.ceil(sorted.length / pageSize) },
      };
    },

    async getPublicProduct(productId) {
      const { products } = await readModel();
      const product = products.find(
        (product) => product.id === productId
          && getSeoVisibility(product, product.variants).public,
      );
      if (!product) return null;
      const [mediaAssets, providerOffers] = await Promise.all([publicMediaAssets(), publicProviderOffers()]);
      return toPublicProduct(product, product.variants, { mediaAssets, providerOffers });
    },

    async getPublicProductBySlug(slug) {
      const { products } = await readModel();
      const product = products.find(
        (candidate) => candidate.slug === slug
          && getSeoVisibility(candidate, candidate.variants).public,
      );
      if (!product) return null;
      const [mediaAssets, providerOffers] = await Promise.all([publicMediaAssets(), publicProviderOffers()]);
      return toPublicProduct(product, product.variants, { mediaAssets, providerOffers });
    },

    async getPublicVariants(productId) {
      const { products } = await readModel();
      const product = products.find((candidate) => candidate.id === productId);
      if (!product || !getSeoVisibility(product, product.variants).public) return null;
      return publicVariantsForProduct(product, product.variants, { providerOffers: await publicProviderOffers() });
    },
  };
};
