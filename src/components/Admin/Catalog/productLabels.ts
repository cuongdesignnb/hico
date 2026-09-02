import type {
  CatalogStatus,
  CoverageType,
  FulfillmentMethod,
  ProductOperation,
  SimMedium,
  Supplier,
} from '../../../types/catalog';

export const OPERATION_LABELS: Record<ProductOperation, string> = {
  new_subscription: 'Mua SIM mới',
  topup: 'Top-up',
  device_sale: 'Thiết bị',
};

export const OPERATION_SHORT_LABELS: Record<ProductOperation, string> = {
  new_subscription: 'eSIM',
  topup: 'Top-up',
  device_sale: 'Thiết bị',
};

export const COVERAGE_LABELS: Record<CoverageType, string> = {
  country: 'Một quốc gia',
  region: 'Khu vực',
  global: 'Toàn cầu',
  not_applicable: 'Không áp dụng',
};

export const STATUS_LABELS: Record<CatalogStatus, string> = {
  active: 'Đang bán',
  draft: 'Bản nháp',
  archived: 'Lưu trữ',
};

export const SUPPLIER_LABELS: Record<Supplier, string> = {
  worldmove: 'Worldmove',
  local_carrier: 'Nhà mạng địa phương',
  hico: 'HICO',
  other: 'Chưa xác nhận',
};

export const MEDIUM_LABELS: Record<Exclude<SimMedium, null>, string> = {
  esim: 'eSIM',
  physical_sim: 'SIM vật lý',
};

export const MEDIUM_CHIP_LABELS: Record<Exclude<SimMedium, null>, string> = {
  esim: 'eSIM',
  physical_sim: 'SIM vật lý',
};

export const FULFILLMENT_LABELS: Record<FulfillmentMethod, string> = {
  WORLDMOVE_ESIM_REDEEM: 'Worldmove — Redeem',
  WORLDMOVE_ESIM_ORDER_THEN_REDEEM: 'Worldmove — Order → Redeem',
  WORLDMOVE_PHYSICAL_ORDER: 'Worldmove — Physical Order',
  WORLDMOVE_TOPUP: 'Worldmove — Top-up',
  HICO_MANUAL_QR: 'HICO — Manual QR',
  HICO_PHYSICAL_STOCK: 'HICO — Physical Stock',
  EXTERNAL_PROVIDER_API: 'External API',
  MANUAL_PROCESSING: 'Manual Processing',
};

export const CURRENCY_LABELS = {
  VND: 'VND',
  USD: 'USD',
} as const;

export const formatVariantPrice = (price: number, currency: 'VND' | 'USD') => {
  const fractionDigits = currency === 'USD' ? 2 : 0;
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(price);
};

export const formatPriceWithCurrency = (price: number, currency: 'VND' | 'USD') => (
  `${formatVariantPrice(price, currency)} ${currency}`
);

export const getLowestVariantPrice = (variants: Array<{ price: number; currency: 'VND' | 'USD'; active: boolean }>) => {
  const activeVariants = variants.filter((variant) => variant.active);
  const candidates = activeVariants.length > 0 ? activeVariants : variants;
  if (candidates.length === 0) return null;

  // Group by currency and find min per currency
  const byCurrency: Record<string, typeof candidates[0]> = {};
  for (const variant of candidates) {
    if (!byCurrency[variant.currency] || variant.price < byCurrency[variant.currency].price) {
      byCurrency[variant.currency] = variant;
    }
  }

  // Return array of lowest per currency, or single if only one currency
  const prices = Object.values(byCurrency);
  return prices.length === 1 ? prices[0] : prices;
};