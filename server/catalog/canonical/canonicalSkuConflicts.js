import { sha256 } from './canonicalCatalogChecksum.js';

export const normalizeSku = (sku) => String(sku ?? '').trim().toUpperCase();
export const normalizeWmid = (wmproductId) => String(wmproductId ?? '').normalize('NFC').trim().toUpperCase();

export const legacyDuplicateGroupId = (sku) => (
  `legacy-sku-${sha256(normalizeSku(sku)).slice(0, 16)}`
);

export const duplicateSkuGroupsFor = (variants = []) => {
  const groups = new Map();
  for (const variant of variants) {
    const sku = normalizeSku(variant?.sku);
    if (!sku) continue;
    const identity = normalizeWmid(variant?.wmproductId);
    const key = `${sku}\u0000${identity}`;
    groups.set(key, [...(groups.get(key) ?? []), variant]);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, variantsForKey]) => ({
      key,
      sku: normalizeSku(variantsForKey[0].sku),
      variants: variantsForKey,
    }));
};

export const skuConflictFor = (variant, variants = []) => {
  const sku = normalizeSku(variant?.sku);
  if (!sku) return false;
  return duplicateSkuGroupsFor(variants).some((group) => group.variants.includes(variant));
};

export const applySkuConflictMetadata = (variants) => {
  const conflicts = new Set(duplicateSkuGroupsFor(variants).flatMap((group) => group.variants));

  return variants.map((variant) => {
    if (conflicts.has(variant)) {
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

