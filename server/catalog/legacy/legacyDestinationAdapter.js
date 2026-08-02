import { adaptLegacyVariant } from './legacyVariantAdapter.js';

const compact = (entries) => Object.fromEntries(
  entries.filter(([, value]) => value !== undefined),
);

export const adaptLegacyDestination = (product, variants) => {
  const projection = product.legacyProjection ?? {};
  const unsupported = [];
  const adaptedVariants = [];

  for (const canonicalVariant of variants) {
    const adapted = adaptLegacyVariant(canonicalVariant);
    if (adapted.unsupported) unsupported.push(adapted.unsupported);
    else adaptedVariants.push(adapted.variant);
  }

  return {
    item: compact([
      ['id', projection.id ?? product.id],
      ['sku', projection.sku],
      ['name', projection.name ?? product.name],
      ['flag', projection.flag],
      ['dataLimit', projection.dataLimit],
      ['duration', projection.duration],
      ['price', projection.price],
      ['compareAtPrice', projection.compareAtPrice],
      ['wmproductId', projection.wmproductId],
      ['image', projection.image ?? product.image],
      ['network', projection.network],
      ['featured', projection.featured ?? product.featured],
      ['guide', projection.guide ?? product.guide],
      ['leSIM', projection.leSIM],
      ['variants', adaptedVariants],
      ['seoTitle', projection.seoTitle ?? product.seoTitle],
      ['seoDescription', projection.seoDescription ?? product.seoDescription],
      ['seoKeywords', projection.seoKeywords ?? product.seoKeywords],
    ]),
    unsupported,
  };
};
