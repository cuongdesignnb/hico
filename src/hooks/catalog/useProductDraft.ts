import { useMemo } from 'react';
import type { CatalogProductRecord } from '../../types/catalog';
import type { ProductDraft } from '../../types/productWizard';

export const createProductDraft = (product?: CatalogProductRecord): ProductDraft => ({
  name: product?.name ?? '',
  slug: product?.slug ?? '',
  operation: product?.operation ?? 'new_subscription',
  coverageType: product?.coverageType ?? 'country',
  coverageIds: product?.coverageIds ?? [],
  image: product?.image ?? '',
  description: product?.description ?? '',
  guide: product?.guide ?? '',
  featured: product?.featured ?? false,
  seoTitle: product?.seoTitle ?? '',
  seoDescription: product?.seoDescription ?? '',
  seoKeywords: product?.seoKeywords ?? '',
});

export const useProductDraft = (product?: CatalogProductRecord) => (
  useMemo(() => createProductDraft(product), [product])
);
