import { getProductImages, getProductMedia, productMediaCategory } from '../utils/productMedia';
import type { PublicProduct, PublicVariant } from '../types/publicCatalog';

export interface ProductDetailImage {
  url: string;
  title: string;
}

export interface ProductFaqItem {
  question: string;
  answer: string;
}

export interface ProductDetailVariantViewModel {
  id: string;
  productId: string;
  sku: string;
  simTypeLabel?: string;
  dataLimitLabel?: string;
  durationLabel?: string;
  price: number;
  compareAtPrice?: number;
  currency: 'VND' | 'USD';
  active: boolean;
  availability: 'available' | 'out_of_stock' | 'unavailable';
  colorLabel?: string;
  bundleLabel?: string;
  deviceModelLabel?: string;
  apn?: string;
  networkLabel?: string;
  publicNote?: string;
}

export interface ProductDetailViewModel {
  id: string;
  slug: string;
  name: string;
  operation: PublicProduct['operation'];
  coverageLabel?: string;
  flag?: string;
  regionLabel?: string;
  networkLabel?: string;
  primaryImage: string;
  gallery: ProductDetailImage[];
  priceDisplay?: string;
  comparePriceDisplay?: string;
  currency?: 'VND' | 'USD';
  description?: string;
  guide?: string;
  technicalContent?: string;
  installationContent?: string;
  compatibilityContent?: string;
  faqItems: ProductFaqItem[];
  variants: ProductDetailVariantViewModel[];
}

const stripHtml = (value: string | undefined) => value
  ?.replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const coverageLabel = (product: PublicProduct) => {
  if (product.coverageLabel) return product.coverageLabel;
  if (product.operation === 'device_sale') return 'Thiết bị';
  if (product.operation === 'topup') return 'Nạp thêm';
  if (product.coverageType === 'global') return 'Toàn cầu';
  if (product.coverageType === 'region') return 'Khu vực';
  return 'Điểm đến';
};

const mediumLabel = (variant: PublicVariant, product: PublicProduct) => {
  if (product.operation === 'device_sale') return 'Thiết bị';
  if (variant.medium === 'physical_sim') return 'SIM vật lý';
  if (variant.medium === 'esim') return 'eSIM';
  return 'Gói canonical';
};

const variantAvailability = (variant: PublicVariant): ProductDetailVariantViewModel['availability'] => {
  if (!variant.active) return 'unavailable';
  if (variant.availability.stockKnown && !variant.availability.inStock) return 'out_of_stock';
  return 'available';
};

const toVariantViewModel = (variant: PublicVariant, product: PublicProduct): ProductDetailVariantViewModel => ({
  id: variant.id,
  productId: variant.productId,
  sku: variant.sku,
  simTypeLabel: mediumLabel(variant, product),
  dataLimitLabel: variant.dataLimit ?? undefined,
  durationLabel: variant.duration ?? undefined,
  price: variant.price,
  compareAtPrice: variant.compareAtPrice ?? undefined,
  currency: variant.currency,
  active: variant.active,
  availability: variantAvailability(variant),
  deviceModelLabel: variant.deviceSpecifications?.model
    ?? variant.deviceSpecs?.model
    ?? product.deviceSpecifications?.model
    ?? product.deviceSpecs?.model,
  apn: variant.apn,
  networkLabel: variant.networkLabel,
  publicNote: variant.publicNote,
});

export const toProductDetailViewModel = (product: PublicProduct): ProductDetailViewModel => {
  const images = getProductImages(product);
  const variants = product.variants.map((variant) => toVariantViewModel(variant, product));
  const firstVariant = variants[0];
  const description = product.description || stripHtml(product.guide);
  const technicalContent = product.operation === 'device_sale'
    ? product.instructions || product.deviceSpecifications?.model || product.deviceSpecs?.model || 'Thông số kỹ thuật được lấy từ dữ liệu canonical của sản phẩm.'
    : firstVariant?.simTypeLabel === 'SIM vật lý'
      ? 'Thông tin gói SIM vật lý và điều kiện giao hàng được lấy từ variant canonical.'
      : 'Thông tin gói và điều kiện sử dụng được lấy từ dữ liệu canonical.';
  const installationContent = product.installationGuide || product.guide || 'Hướng dẫn cài đặt sẽ được cập nhật từ nội dung canonical của sản phẩm.';
  const compatibilityContent = product.compatibilityContent || (product.operation === 'device_sale'
    ? product.deviceSpecifications?.simCompatibility || product.deviceSpecs?.simCompatibility || 'Thông tin tương thích đang được cập nhật từ dữ liệu canonical.'
    : firstVariant?.simTypeLabel === 'SIM vật lý'
      ? 'Thiết bị cần hỗ trợ SIM vật lý và kết nối mạng tương thích.'
      : 'Thiết bị cần hỗ trợ eSIM và không bị khóa mạng.');
/*
  const technicalContent = product.operation === 'device_sale'
    ? 'Thông số kỹ thuật được lấy từ dữ liệu canonical của sản phẩm.'
    : firstVariant?.simTypeLabel === 'SIM vật lý'
      ? 'Thông tin gói SIM vật lý và điều kiện giao hàng được lấy từ variant canonical.'
      : 'Thông tin gói và điều kiện sử dụng được lấy từ dữ liệu canonical.';
  const installationContent = product.guide || 'Hướng dẫn cài đặt sẽ được cập nhật từ nội dung canonical của sản phẩm.';
  const compatibilityContent = product.operation === 'device_sale'
    ? product.deviceSpecs?.simCompatibility || 'Thông tin tương thích đang được cập nhật từ dữ liệu canonical.'
    : firstVariant?.simTypeLabel === 'SIM vật lý'
      ? 'Thiết bị cần hỗ trợ SIM vật lý và kết nối mạng tương thích.'
      : 'Thiết bị cần hỗ trợ eSIM và không bị khóa mạng.';
*/

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    operation: product.operation,
    coverageLabel: coverageLabel(product),
    networkLabel: product.networkLabel,
    regionLabel: product.coverageType,
    primaryImage: getProductMedia(product),
    gallery: images.map((url) => ({ url, title: product.name })),
    priceDisplay: firstVariant ? `${firstVariant.price.toLocaleString('vi-VN')} ${firstVariant.currency}` : undefined,
    comparePriceDisplay: firstVariant?.compareAtPrice ? `${firstVariant.compareAtPrice.toLocaleString('vi-VN')} ${firstVariant.currency}` : undefined,
    currency: firstVariant?.currency,
    description,
    guide: product.guide,
    technicalContent,
    installationContent,
    compatibilityContent,
    faqItems: product.faqItems.map(({ question, answer }) => ({ question, answer })),
    variants,
  };
};

export const productCategoryLabel = (product: PublicProduct) => {
  const category = productMediaCategory(product);
  if (category === 'device') return 'Thiết bị';
  if (category === 'topup') return 'Top-up';
  if (category === 'physical_sim') return 'SIM vật lý';
  return 'eSIM';
};
