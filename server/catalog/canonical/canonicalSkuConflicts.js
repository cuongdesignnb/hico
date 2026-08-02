import { sha256 } from './canonicalCatalogChecksum.js';

export const normalizeSku = (sku) => String(sku ?? '').trim().toUpperCase();

export const legacyDuplicateGroupId = (sku) => (
  `legacy-sku-${sha256(normalizeSku(sku)).slice(0, 16)}`
);

export const applySkuConflictMetadata = (variants) => {
  const groups = new Map();
  for (const variant of variants) {
    const normalized = normalizeSku(variant.sku);
    const group = groups.get(normalized) ?? [];
    group.push(variant);
    groups.set(normalized, group);
  }

  return variants.map((variant) => {
    const group = groups.get(normalizeSku(variant.sku)) ?? [];
    if (group.length > 1) {
      return {
        ...variant,
        skuConflict: true,
        legacyDuplicateGroupId: legacyDuplicateGroupId(variant.sku),
      };
    }

    const {
      skuConflict: _skuConflict,
      legacyDuplicateGroupId: _legacyDuplicateGroupId,
      ...withoutConflict
    } = variant;
    return withoutConflict;
  });
};

