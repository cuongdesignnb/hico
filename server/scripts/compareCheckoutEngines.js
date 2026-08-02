import { createCatalogRepository } from '../catalog/catalogRepository.js';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { createCanonicalCatalogReader } from '../catalog/canonical/canonicalCatalogReader.js';

export const compareCheckoutEngines = async ({ legacyRepository, canonicalRepository } = {}) => {
  const reader = createCanonicalCatalogReader({
    env: { CATALOG_READ_SOURCE: 'canonical' },
    legacyRepository: legacyRepository ?? createCatalogRepository(),
    canonicalRepository: canonicalRepository ?? createCanonicalCatalogRepository(),
  });
  const [legacy, canonical] = await Promise.all([
    (legacyRepository ?? createCatalogRepository()).readLegacyCatalog(),
    reader.readCatalog(),
  ]);
  const legacyVariants = new Map([...legacy.destinations, ...legacy.packages].flatMap((product) => (
    (product.variants ?? []).map((variant) => [variant.id, { productId: product.id, price: variant.price, currency: variant.currency ?? 'VND', wmproductId: variant.wmproductId }])
  )));
  const canonicalVariants = new Map(canonical.variants.map((variant) => [variant.id, variant]));
  const normalize = (value) => value === '' || value === undefined ? null : value;
  const differences = [];
  for (const [variantId, legacyVariant] of legacyVariants) {
    const canonicalVariant = canonicalVariants.get(variantId);
    if (!canonicalVariant) {
      differences.push({ variantId, code: 'MISSING_CANONICAL_VARIANT' });
      continue;
    }
    for (const field of ['productId', 'price', 'currency', 'wmproductId']) {
      if (normalize(legacyVariant[field]) !== normalize(canonicalVariant[field])) differences.push({ variantId, field, legacy: normalize(legacyVariant[field]), canonical: normalize(canonicalVariant[field]) });
    }
  }
  return {
    comparedAt: new Date().toISOString(),
    legacyVariantCount: legacyVariants.size,
    canonicalVariantCount: canonicalVariants.size,
    differences,
    parity: differences.length === 0,
  };
};

if (process.argv[1]?.endsWith('compareCheckoutEngines.js')) {
  const report = await compareCheckoutEngines();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.parity ? 0 : 1;
}
