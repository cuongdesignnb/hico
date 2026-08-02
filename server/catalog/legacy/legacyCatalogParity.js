const DESTINATION_FIELDS = [
  'sku',
  'name',
  'flag',
  'dataLimit',
  'duration',
  'price',
  'compareAtPrice',
  'wmproductId',
  'image',
  'network',
  'featured',
  'guide',
  'leSIM',
  'seoTitle',
  'seoDescription',
  'seoKeywords',
];
const PACKAGE_FIELDS = [
  'sku',
  'name',
  'coverage',
  'dataLimit',
  'duration',
  'price',
  'compareAtPrice',
  'wmproductId',
  'network',
  'description',
  'featured',
  'iconType',
  'leSIM',
  'seoTitle',
  'seoDescription',
  'seoKeywords',
];
const VARIANT_FIELDS = [
  'sku',
  'dataLimit',
  'duration',
  'price',
  'compareAtPrice',
  'wmproductId',
  'simType',
  'leSIM',
];

const valueEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const idDifferences = (left, right) => {
  const rightIds = new Set(right.map((item) => item.id));
  return left.map((item) => item.id).filter((id) => !rightIds.has(id)).sort();
};

const compareProducts = ({
  type,
  legacyItems,
  adaptedItems,
  fields,
  changedProductFields,
  changedVariantFields,
}) => {
  const adaptedById = new Map(adaptedItems.map((item) => [item.id, item]));
  for (const legacy of legacyItems) {
    const adapted = adaptedById.get(legacy.id);
    if (!adapted) continue;
    for (const field of fields) {
      if (!valueEqual(legacy[field], adapted[field])) {
        changedProductFields.push({
          type,
          id: legacy.id,
          field,
          legacy: legacy[field] ?? null,
          adapted: adapted[field] ?? null,
        });
      }
    }

    const adaptedVariants = new Map(
      (adapted.variants ?? []).map((variant) => [variant.id, variant]),
    );
    const legacyOrder = (legacy.variants ?? []).map((variant) => variant.id);
    const adaptedOrder = (adapted.variants ?? []).map((variant) => variant.id);
    if (!valueEqual(legacyOrder, adaptedOrder)) {
      changedVariantFields.push({
        type,
        productId: legacy.id,
        field: 'order',
        legacy: legacyOrder,
        adapted: adaptedOrder,
      });
    }
    for (const legacyVariant of legacy.variants ?? []) {
      const adaptedVariant = adaptedVariants.get(legacyVariant.id);
      if (!adaptedVariant) {
        changedVariantFields.push({
          type,
          productId: legacy.id,
          variantId: legacyVariant.id,
          field: 'missing',
        });
        continue;
      }
      for (const field of VARIANT_FIELDS) {
        if (!valueEqual(legacyVariant[field], adaptedVariant[field])) {
          changedVariantFields.push({
            type,
            productId: legacy.id,
            variantId: legacyVariant.id,
            field,
            legacy: legacyVariant[field] ?? null,
            adapted: adaptedVariant[field] ?? null,
          });
        }
      }
    }
  }
};

export const createLegacyCatalogParity = ({
  legacy,
  adapted,
  startedAt,
  completedAt,
}) => {
  const changedProductFields = [];
  const changedVariantFields = [];
  compareProducts({
    type: 'destination',
    legacyItems: legacy.destinations,
    adaptedItems: adapted.destinations,
    fields: DESTINATION_FIELDS,
    changedProductFields,
    changedVariantFields,
  });
  compareProducts({
    type: 'package',
    legacyItems: legacy.packages,
    adaptedItems: adapted.packages,
    fields: PACKAGE_FIELDS,
    changedProductFields,
    changedVariantFields,
  });

  const report = {
    startedAt,
    completedAt,
    legacyDestinations: legacy.destinations.length,
    adaptedDestinations: adapted.destinations.length,
    legacyPackages: legacy.packages.length,
    adaptedPackages: adapted.packages.length,
    missingDestinationIds: idDifferences(
      legacy.destinations,
      adapted.destinations,
    ),
    extraDestinationIds: idDifferences(
      adapted.destinations,
      legacy.destinations,
    ),
    missingPackageIds: idDifferences(legacy.packages, adapted.packages),
    extraPackageIds: idDifferences(adapted.packages, legacy.packages),
    changedProductFields,
    changedVariantFields,
    unsupportedLegacyProjection:
      adapted.diagnostics.unsupportedLegacyProjection,
    classificationConflicts: adapted.diagnostics.classificationConflicts,
  };
  report.success = [
    report.missingDestinationIds,
    report.extraDestinationIds,
    report.missingPackageIds,
    report.extraPackageIds,
    report.changedProductFields,
    report.changedVariantFields,
    report.unsupportedLegacyProjection,
    report.classificationConflicts,
  ].every((items) => items.length === 0);
  return report;
};
