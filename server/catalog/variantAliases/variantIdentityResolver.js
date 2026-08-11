import { normalizeExternalKey } from './variantAliasValidation.js';

export const namespaceForMedium = (medium) => medium === 'physical_sim' ? 'SIM_HICO_SKU_PHYSICAL' : 'SIM_HICO_SKU_ESIM';

const activeAliasFor = ({ aliases = [], medium, sku }) => aliases.find((alias) => (
  alias.status === 'ACTIVE' && alias.namespace === namespaceForMedium(medium)
  && alias.medium === medium && alias.normalizedExternalKey === normalizeExternalKey(sku)
));

export const resolveSheetVariantIdentity = ({ row, products = [], variants = [], aliases = [] }) => {
  const data = row.normalizedData ?? {};
  const directMatches = data.variantId
    ? variants.filter((variant) => variant.id === data.variantId)
    : variants.filter((variant) => normalizeExternalKey(variant.sku) === normalizeExternalKey(data.sku) && (!data.medium || variant.medium === data.medium));
  const alias = data.sku && data.medium ? activeAliasFor({ aliases, medium: data.medium, sku: data.sku }) : null;
  if (directMatches.length > 1) return { error: { code: 'AMBIGUOUS_VARIANT' } };
  if (directMatches.length === 1 && alias && alias.variantId !== directMatches[0].id) return { error: { code: 'IDENTITY_CONFLICT', details: { directVariantId: directMatches[0].id, aliasVariantId: alias.variantId } } };
  const variant = directMatches[0] ?? variants.find((item) => item.id === alias?.variantId);
  if (!variant) return { error: { code: alias ? 'EXTERNAL_ALIAS_TARGET_NOT_FOUND' : 'UNMATCHED_VARIANT' } };
  const product = products.find((item) => item.id === variant.productId);
  if (!product || product.status === 'archived' || variant.archived === true) return { error: { code: 'VARIANT_ARCHIVED' } };
  if (data.productSlug && product.slug !== data.productSlug) return { error: { code: 'PRODUCT_SLUG_MISMATCH' } };
  if (data.sku && !alias && normalizeExternalKey(variant.sku) !== normalizeExternalKey(data.sku)) return { error: { code: 'SKU_MISMATCH' } };
  if (data.medium && variant.medium !== data.medium) return { error: { code: 'MEDIUM_MISMATCH' } };
  return { product, variant, identityMatch: alias && !directMatches.length ? 'MATCHED_ALIAS' : 'MATCHED_CANONICAL' };
};
