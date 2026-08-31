import type { PublicProduct } from '../types/publicCatalog';

export type ProductMediaCategory = 'esim' | 'physical_sim' | 'device' | 'topup';

const neutralMedia: Record<ProductMediaCategory, string> = {
  esim: '/images/art_esim_intro.png',
  physical_sim: '/images/art_sim_compare.png',
  device: '/images/device_wifi_mini.png',
  topup: '/images/art_esim_intro.png',
};

export const productMediaCategory = (product: Pick<PublicProduct, 'operation' | 'variants'>): ProductMediaCategory => {
  if (product.operation === 'device_sale') return 'device';
  if (product.operation === 'topup') return 'topup';
  return product.variants.some((variant) => variant.medium === 'physical_sim') && !product.variants.some((variant) => variant.medium === 'esim')
    ? 'physical_sim'
    : 'esim';
};

export const getProductImages = (product: PublicProduct): string[] => {
  const galleryUrls = Array.isArray(product.gallery) ? product.gallery.map((item) => item.url) : [];
  const values = [product.primaryImage, product.image, ...galleryUrls, ...product.images]
    .filter((value): value is string => Boolean(value && value.trim()));
  return [...new Set(values)];
};

export const getProductMedia = (product: PublicProduct): string => (
  getProductImages(product)[0] ?? neutralMedia[productMediaCategory(product)]
);

export const getNeutralProductMedia = (category: ProductMediaCategory): string => neutralMedia[category];
