import { adaptLegacyVariant } from './legacyVariantAdapter.js';

const compact = (entries) => Object.fromEntries(
  entries.filter(([, value]) => value !== undefined),
);

export const adaptLegacyPackage = (product, variants) => {
  const projection = product.legacyProjection ?? {};
  const unsupported = [];
  const adaptedVariants = [];

  for (const canonicalVariant of variants) {
    const adapted = adaptLegacyVariant(canonicalVariant);
    if (adapted.unsupported) unsupported.push(adapted.unsupported);
    else adaptedVariants.push(adapted.variant);
  }

  const iconType = product.coverageType === 'global' ? 'global' : 'region';
  return {
    item: compact([
      ['id', projection.id ?? product.id],
      ['sku', projection.sku],
      ['name', projection.name ?? product.name],
      ['coverage', projection.coverage],
      ['dataLimit', projection.dataLimit],
      ['duration', projection.duration],
      ['price', projection.price],
      ['compareAtPrice', projection.compareAtPrice],
      ['wmproductId', projection.wmproductId],
      ['network', projection.network],
      ['description', projection.description ?? product.description],
      ['featured', projection.featured ?? product.featured],
      ['iconType', projection.iconType ?? iconType],
      ['leSIM', projection.leSIM],
      ['variants', adaptedVariants],
      ['seoTitle', projection.seoTitle ?? product.seoTitle],
      ['seoDescription', projection.seoDescription ?? product.seoDescription],
      ['seoKeywords', projection.seoKeywords ?? product.seoKeywords],
    ]),
    unsupported,
  };
};
