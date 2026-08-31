import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { getSeoVisibility } from '../seo/seoVisibility.js';
import { toPublicProduct, PUBLIC_FORBIDDEN_KEYS } from '../catalog/publicCatalogProjection.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const operations = ['new_subscription', 'topup', 'device_sale'];
const contract = {
  productCore: ['id', 'slug', 'name', 'operation', 'coverageType', 'coverageIds', 'status'],
  media: ['primaryImage', 'images', 'gallery'],
  variantCommon: ['id', 'productId', 'sku', 'price', 'currency', 'active', 'availability'],
  esim: ['dataLimit', 'duration', 'medium', 'instantDeliveryLabel', 'installationGuide'],
  physicalSim: ['medium', 'shippingRequired', 'deliveryNote', 'simSize'],
  topup: ['operation', 'dataLimit', 'duration'],
  device: ['operation', 'deviceSpecifications', 'shippingRequired'],
  content: ['description', 'guide', 'installationGuide', 'compatibilityContent', 'faqItems'],
};

const sourceFiles = [
  'server/catalog/catalogRouter.js',
  'server/catalog/public/publicProductSerializer.js',
  'src/services/publicCatalogApi.ts',
  'src/hooks/catalog/usePublicProductBySlug.ts',
  'src/adapters/productDetailViewModel.ts',
  'src/components/ProductDetail/ProductDetail.tsx',
  'src/components/Admin/Catalog/ProductWizard/ProductWizard.tsx',
  'src/components/Admin/Catalog/ProductWizard/ProductGeneralStep.tsx',
];

const hasFields = (record, fields) => fields.filter((field) => record?.[field] !== undefined);
const missingFields = (record, fields) => fields.filter((field) => record?.[field] === undefined);
const representative = (products, operation) => products.find((product) => product.operation === operation);

export const auditAdminPublicProductContract = async ({ uploadsDirectory = defaultUploadsDirectory } = {}) => {
  const { products, variants } = await createCanonicalCatalogRepository({ uploadsDirectory }).readCatalog({ required: true });
  const publicRecords = products
    .map((product) => ({ product, variants: variants.filter((variant) => variant.productId === product.id) }))
    .filter(({ product, variants: productVariants }) => getSeoVisibility(product, productVariants).public)
    .map(({ product, variants: productVariants }) => toPublicProduct(product, productVariants));
  const publicVariants = publicRecords.flatMap((product) => product.variants);
  const byOperation = Object.fromEntries(operations.map((operation) => [operation, publicRecords.filter((product) => product.operation === operation).length]));
  const representativeProducts = Object.fromEntries(operations.map((operation) => {
    const product = representative(publicRecords, operation);
    const variant = product?.variants[0];
    return [operation, {
      present: Boolean(product),
      productFields: hasFields(product, [...contract.productCore, ...contract.media, ...contract.content]),
      missingProductFields: missingFields(product, contract.productCore),
      variantFields: hasFields(variant, contract.variantCommon),
      missingVariantFields: missingFields(variant, contract.variantCommon),
      typeFields: hasFields(product ?? variant, contract[operation === 'new_subscription' ? 'esim' : operation === 'device_sale' ? 'device' : 'topup']),
    }];
  }));
  const sourceChecks = {};
  for (const relative of sourceFiles) {
    const source = await readFile(path.join(root, relative), 'utf8');
    sourceChecks[relative] = {
      readable: true,
      usesCanonicalPublicPath: relative.includes('ProductDetail') || relative.includes('publicCatalog') || relative.includes('publicCatalogApi') || relative.includes('usePublicProductBySlug') ? /public|canonical/i.test(source) : true,
      usesAdminProductPath: /\/api\/admin\/(?:destinations|packages)/.test(source),
    };
  }
  const hardcodedAdminCalls = Object.entries(sourceChecks).filter(([, check]) => check.usesAdminProductPath).map(([file]) => file);
  const forbiddenPublicFields = publicVariants.flatMap((variant) => [...PUBLIC_FORBIDDEN_KEYS].filter((key) => key in variant));
  return {
    success: hardcodedAdminCalls.length === 0 && forbiddenPublicFields.length === 0 && Object.values(representativeProducts).filter((item) => item.present).every((item) => item.missingProductFields.length === 0 && item.missingVariantFields.length === 0),
    contract,
    productsByOperation: byOperation,
    totals: { products: products.length, variants: variants.length, publicProducts: publicRecords.length, publicVariants: publicVariants.length },
    representativeProducts,
    sourceChecks,
    hardcodedAdminCalls,
    forbiddenPublicFields,
    note: 'Type-specific optional data is reported as a gap when absent; no fallback value is generated.',
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  auditAdminPublicProductContract()
    .then((result) => { console.log(JSON.stringify(result, null, 2)); if (!result.success) process.exitCode = 1; })
    .catch((error) => { console.error(JSON.stringify({ success: false, error: error.message })); process.exitCode = 1; });
}
