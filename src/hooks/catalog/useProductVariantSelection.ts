import { useEffect, useMemo, useState } from 'react';
import type { PublicProduct, PublicVariant } from '../../types/publicCatalog';

export const useProductVariantSelection = (product: PublicProduct | null | undefined) => {
  const [variantId, setVariantId] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => setVariantId(product?.variants[0]?.id ?? null));
  }, [product?.id, product?.variants]);
  const variant = useMemo<PublicVariant | null>(() => product?.variants.find((item) => item.id === variantId) ?? null, [product?.variants, variantId]);
  return { variant, variantId, setVariantId };
};
