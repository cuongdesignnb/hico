import { createHash } from 'node:crypto';

export const PUBLIC_SKU_PATTERN = /^HICO-[A-F0-9]{8}$/;

const digest = (value) => createHash('sha256').update(String(value)).digest('hex').toUpperCase();

export const publicSkuForVariantId = (variantId, attempt = 0) => (
  `HICO-${digest(`${variantId}:${attempt}`).slice(0, 8)}`
);

export const publicSkuForVariant = (variant) => (
  PUBLIC_SKU_PATTERN.test(variant?.publicSku ?? '')
    ? variant.publicSku
    : publicSkuForVariantId(variant?.id ?? 'unknown')
);

export const publicSkuForOrderItem = (item) => {
  if (PUBLIC_SKU_PATTERN.test(item?.publicSku ?? '')) return item.publicSku;
  if (PUBLIC_SKU_PATTERN.test(item?.sku ?? '')) return item.sku;
  return item?.variantId ? publicSkuForVariantId(item.variantId) : null;
};

export const backfillVariantPublicSkus = (variants) => {
  const used = new Set(variants.map((variant) => variant.publicSku).filter((value) => PUBLIC_SKU_PATTERN.test(value)));
  let assigned = 0;
  const rows = variants.map((variant) => {
    if (PUBLIC_SKU_PATTERN.test(variant.publicSku ?? '')) return variant;
    let attempt = 0;
    let publicSku = publicSkuForVariantId(variant.id, attempt);
    while (used.has(publicSku)) {
      attempt += 1;
      publicSku = publicSkuForVariantId(variant.id, attempt);
    }
    used.add(publicSku);
    assigned += 1;
    return { ...variant, publicSku };
  });
  return { variants: rows, assigned };
};
