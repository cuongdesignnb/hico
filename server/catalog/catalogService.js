import { mapLegacyCatalog } from './catalogMapper.js';
import {
  createCanonicalCatalogReader,
} from './canonical/canonicalCatalogReader.js';
import { getSeoVisibility } from '../seo/seoVisibility.js';

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
) => {
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

    async listPublicProducts() {
      const products = await readProducts();
      return products.filter((product) => getSeoVisibility(product, product.variants).public);
    },

    async getPublicProduct(productId) {
      const products = await readProducts();
      return products.find(
        (product) => product.id === productId
          && getSeoVisibility(product, product.variants).public,
      ) ?? null;
    },
  };
};
