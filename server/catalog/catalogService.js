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

export const createCatalogService = (
  reader = createCanonicalCatalogReader(),
  { mediaAssetRepository = null, providerRepository = createProviderOfferRepository() } = {},
) => {
  const publicMediaAssets = async () => mediaAssetRepository?.list?.() ?? [];
  const publicProviderOffers = async () => providerRepository?.listOffers?.() ?? [];
  const readProducts = async () => {
    const catalog = typeof reader.readCatalog === 'function'
      ? await reader.readCatalog()
      : mapLegacyCatalog(await reader.readLegacyCatalog());
    return attachVariants(catalog);
  };

  return {
    async listAdminProducts() {
      return readProducts();
    },

    async listPublicProducts({ filters = {}, paginate = false } = {}) {
      const products = await readProducts();
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
      const products = await readProducts();
      const product = products.find(
        (product) => product.id === productId
          && getSeoVisibility(product, product.variants).public,
      );
      if (!product) return null;
      const [mediaAssets, providerOffers] = await Promise.all([publicMediaAssets(), publicProviderOffers()]);
      return toPublicProduct(product, product.variants, { mediaAssets, providerOffers });
    },

    async getPublicProductBySlug(slug) {
      const products = await readProducts();
      const product = products.find(
        (candidate) => candidate.slug === slug
          && getSeoVisibility(candidate, candidate.variants).public,
      );
      if (!product) return null;
      const [mediaAssets, providerOffers] = await Promise.all([publicMediaAssets(), publicProviderOffers()]);
      return toPublicProduct(product, product.variants, { mediaAssets, providerOffers });
    },

    async getPublicVariants(productId) {
      const products = await readProducts();
      const product = products.find((candidate) => candidate.id === productId);
      if (!product || !getSeoVisibility(product, product.variants).public) return null;
      return publicVariantsForProduct(product, product.variants, { providerOffers: await publicProviderOffers() });
    },
  };
};
