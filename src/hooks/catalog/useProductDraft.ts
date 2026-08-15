import { useMemo } from 'react';
import type { CatalogProductRecord } from '../../types/catalog';
import type { ProductDraft } from '../../types/productWizard';

export const createProductDraft = (product?: CatalogProductRecord): ProductDraft => ({
  name: product?.name ?? '',
  slug: product?.slug ?? '',
  categoryId: product?.categoryId ?? '',
  operation: product?.operation ?? 'new_subscription',
  coverageType: product?.coverageType ?? 'country',
  coverageIds: product?.coverageIds ?? [],
  image: product?.image ?? '',
  primaryMediaId: product?.primaryMediaId ?? null,
  gallery: product?.gallery ?? product?.images ?? [],
  galleryMediaIds: product?.galleryMediaIds ?? [],
  description: product?.description ?? '',
  guide: product?.guide ?? '',
  featured: product?.featured ?? false,
  seoTitle: product?.seoTitle ?? '',
  seoDescription: product?.seoDescription ?? '',
  seoKeywords: product?.seoKeywords ?? '',
  deviceSpecifications: product?.deviceSpecifications ?? product?.deviceSpecs,
  networkLabel: product?.networkLabel ?? '',
  coverageLabel: product?.coverageLabel ?? '',
  speedLabel: product?.speedLabel ?? '',
  installationGuide: product?.installationGuide ?? '',
  compatibilityContent: product?.compatibilityContent ?? '',
  instructions: product?.instructions ?? '',
  eligibilityNote: product?.eligibilityNote ?? '',
  packageContents: product?.packageContents ?? '',
  deliveryNote: product?.deliveryNote ?? '',
  simSize: product?.simSize ?? '',
  faqItems: product?.faqItems ?? [],
});

export const useProductDraft = (product?: CatalogProductRecord) => (
  useMemo(() => createProductDraft(product), [product])
);
