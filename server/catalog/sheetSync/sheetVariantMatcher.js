import { resolveSheetVariantIdentity } from '../variantAliases/variantIdentityResolver.js';

export const matchSheetVariant = ({ row, products, variants, aliases = [] }) => resolveSheetVariantIdentity({ row, products, variants, aliases });
