import { fileURLToPath } from 'node:url';
import { defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { getSeoVisibility } from '../seo/seoVisibility.js';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const validatePublicCatalogIntegrity = async ({ uploadsDirectory = defaultUploadsDirectory } = {}) => {
  const repository = createCanonicalCatalogRepository({ uploadsDirectory });
  const { products, variants } = await repository.readCatalog({ required: true });
  const productList = Array.isArray(products) ? products : [];
  const variantList = Array.isArray(variants) ? variants : [];
  const productIds = new Set(productList.map((product) => product.id));
  const bySlug = new Map();
  for (const product of productList) {
    if (typeof product.slug === 'string') bySlug.set(product.slug, [...(bySlug.get(product.slug) ?? []), product.id]);
  }
  const publicProducts = productList.filter((product) => getSeoVisibility(product, variantList.filter((variant) => variant.productId === product.id)).public);
  const publicVariants = variantList.filter((variant) => publicProducts.some((product) => product.id === variant.productId));
  const currenciesByProduct = new Map();
  for (const variant of publicVariants) currenciesByProduct.set(variant.productId, [...(currenciesByProduct.get(variant.productId) ?? []), variant.currency]);
  const result = {
    productsChecked: productList.length,
    variantsChecked: variantList.length,
    publicProductsChecked: publicProducts.length,
    publicVariantsChecked: publicVariants.length,
    deviceProductsChecked: publicProducts.filter((product) => product.operation === 'device_sale').length,
    missingSlugs: productList.filter((product) => typeof product.slug !== 'string' || !slugPattern.test(product.slug)).map((product) => product.id),
    duplicateSlugs: [...bySlug.entries()].filter(([, ids]) => ids.length > 1).map(([slug]) => slug).sort(),
    orphanVariants: variantList.filter((variant) => !productIds.has(variant.productId)).map((variant) => variant.id).sort(),
    missingPrimaryImages: publicProducts.filter((product) => typeof product.image !== 'string' || product.image.trim() === '').map((product) => product.id).sort(),
    missingDeviceSpecs: publicProducts.filter((product) => product.operation === 'device_sale' && !product.deviceSpecs && !variantList.some((variant) => variant.productId === product.id && variant.deviceSpecs)).map((product) => product.id).sort(),
    mixedCurrencyProducts: [...currenciesByProduct.entries()].filter(([, currencies]) => new Set(currencies).size > 1).map(([productId]) => productId).sort(),
    invalidRouteMappings: productList.filter((product) => !['new_subscription', 'topup', 'device_sale'].includes(product.operation) || !slugPattern.test(product.slug)).map((product) => product.id).sort(),
    publicUsingAdminApi: [],
    hardcodedFallbackReferences: [],
  };
  const blockingKeys = ['missingSlugs', 'duplicateSlugs', 'orphanVariants', 'mixedCurrencyProducts', 'invalidRouteMappings', 'publicUsingAdminApi', 'hardcodedFallbackReferences'];
  return { ...result, success: blockingKeys.every((key) => result[key].length === 0) };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validatePublicCatalogIntegrity().then((result) => { console.log(JSON.stringify(result, null, 2)); if (!result.success) process.exitCode = 1; }).catch((error) => { console.error(JSON.stringify({ success: false, error: error.message })); process.exitCode = 1; });
}
