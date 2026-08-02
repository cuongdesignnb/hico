const sortStrings = (values) => [...values].sort((left, right) => (
  String(left).localeCompare(String(right))
));

const differences = (legacy, canonical, field) => {
  const canonicalById = new Map(canonical.map((item) => [item.id, item]));
  return legacy
    .filter((item) => (
      canonicalById.has(item.id)
      && canonicalById.get(item.id)?.[field] !== item[field]
    ))
    .map((item) => ({
      id: item.id,
      legacy: item[field] ?? null,
      canonical: canonicalById.get(item.id)?.[field] ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
};

export const createCatalogParity = ({
  legacyProducts,
  legacyVariants,
  canonicalProducts,
  canonicalVariants,
  validation,
}) => {
  const legacyProductIds = new Set(legacyProducts.map((item) => item.id));
  const canonicalProductIds = new Set(canonicalProducts.map((item) => item.id));
  const legacyVariantIds = new Set(legacyVariants.map((item) => item.id));
  const canonicalVariantIds = new Set(canonicalVariants.map((item) => item.id));

  return {
    legacyProducts: legacyProducts.length,
    canonicalProducts: canonicalProducts.length,
    legacyVariants: legacyVariants.length,
    canonicalVariants: canonicalVariants.length,
    missingProductIds: sortStrings(
      [...legacyProductIds].filter((id) => !canonicalProductIds.has(id)),
    ),
    extraProductIds: sortStrings(
      [...canonicalProductIds].filter((id) => !legacyProductIds.has(id)),
    ),
    missingVariantIds: sortStrings(
      [...legacyVariantIds].filter((id) => !canonicalVariantIds.has(id)),
    ),
    extraVariantIds: sortStrings(
      [...canonicalVariantIds].filter((id) => !legacyVariantIds.has(id)),
    ),
    changedSkus: differences(legacyVariants, canonicalVariants, 'sku'),
    changedWmproductIds: differences(
      legacyVariants,
      canonicalVariants,
      'wmproductId',
    ),
    changedPrices: differences(legacyVariants, canonicalVariants, 'price'),
    changedCompareAtPrices: differences(
      legacyVariants,
      canonicalVariants,
      'compareAtPrice',
    ),
    duplicateProductIds: validation.duplicateProductIds,
    duplicateVariantIds: validation.duplicateVariantIds,
    duplicateSkus: validation.duplicateSkus,
    duplicateSlugs: validation.duplicateSlugs,
    orphanVariants: validation.orphanVariants,
    orphanManualQrs: validation.orphanManualQrs,
  };
};
