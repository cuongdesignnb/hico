import { fileURLToPath } from 'node:url';
import { defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { getSeoVisibility } from '../seo/seoVisibility.js';
import { toPublicProduct, PUBLIC_FORBIDDEN_KEYS } from '../catalog/publicCatalogProjection.js';

const forbiddenKey = (key) => {
  const normalized = String(key).toLowerCase();
  return [...PUBLIC_FORBIDDEN_KEYS].some((candidate) => normalized === candidate.toLowerCase())
    || /^(provider|token|secret|password|redemption|rawinventory|reconciliation|audit|qr|lpa|pin|puk)/.test(normalized);
};

const findForbiddenKeys = (value, path = '$', findings = []) => {
  if (!value || typeof value !== 'object') return findings;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKey(key)) findings.push(`${path}.${key}`);
    findForbiddenKeys(child, `${path}.${key}`, findings);
  }
  return findings;
};

const publicMediaUrl = (value) => typeof value === 'string' && /^\/(?:images|uploads)\//.test(value);

export const validatePublicProductPayloads = async ({ uploadsDirectory = defaultUploadsDirectory } = {}) => {
  const { products, variants } = await createCanonicalCatalogRepository({ uploadsDirectory }).readCatalog({ required: true });
  const publicProducts = products
    .map((product) => ({ product, variants: variants.filter((variant) => variant.productId === product.id) }))
    .filter(({ product, variants: productVariants }) => getSeoVisibility(product, productVariants).public)
    .map(({ product, variants: productVariants }) => toPublicProduct(product, productVariants));
  const forbiddenKeys = [];
  const mismatchedVariants = [];
  const unpublishedVariants = [];
  const invalidMedia = [];
  const seenProductIds = new Set(publicProducts.map((product) => product.id));

  for (const product of publicProducts) {
    forbiddenKeys.push(...findForbiddenKeys(product, `product:${product.id}`));
    for (const variant of product.variants) {
      if (variant.productId !== product.id) mismatchedVariants.push(variant.id);
      if (variant.active !== true) unpublishedVariants.push(variant.id);
      for (const url of variant.deviceSpecifications?.supportedBands ?? []) {
        if (typeof url !== 'string') invalidMedia.push(`${variant.id}:supportedBands`);
      }
    }
    for (const url of [product.primaryImage, ...product.images, ...product.gallery.map((item) => item.url)].filter(Boolean)) {
      if (!publicMediaUrl(url)) invalidMedia.push(`${product.id}:media`);
    }
  }

  const publicVariantCount = publicProducts.reduce((total, product) => total + product.variants.length, 0);
  const result = {
    success: forbiddenKeys.length === 0 && mismatchedVariants.length === 0 && unpublishedVariants.length === 0 && invalidMedia.length === 0,
    productsChecked: products.length,
    variantsChecked: variants.length,
    publicProductsChecked: publicProducts.length,
    publicVariantsChecked: publicVariantCount,
    productsByOperation: Object.fromEntries(['new_subscription', 'topup', 'device_sale'].map((operation) => [operation, publicProducts.filter((product) => product.operation === operation).length])),
    productIdsWithoutPublicVariants: products.filter((product) => seenProductIds.has(product.id) === false && getSeoVisibility(product, variants.filter((variant) => variant.productId === product.id)).public).map((product) => product.id),
    forbiddenKeys,
    mismatchedVariants,
    unpublishedVariants,
    invalidMedia,
  };
  return result;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validatePublicProductPayloads()
    .then((result) => { console.log(JSON.stringify(result, null, 2)); if (!result.success) process.exitCode = 1; })
    .catch((error) => { console.error(JSON.stringify({ success: false, error: error.message })); process.exitCode = 1; });
}
