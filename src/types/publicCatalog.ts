export type PublicOperation = 'new_subscription' | 'topup' | 'device_sale';
export type PublicCoverageType = 'country' | 'region' | 'global' | 'not_applicable';
export type PublicMedium = 'esim' | 'physical_sim' | null;
export type PublicCurrency = 'VND' | 'USD';
export type PublicPurchaseAction = 'buy_esim' | 'topup_sim' | 'buy_physical_sim';

export interface PublicDeviceSpecs {
  brand?: string;
  model?: string;
  networkGeneration?: string;
  formFactor?: string;
  supportedBands?: string[];
  wifiStandard?: string;
  maxConnectedDevices?: number;
  batteryCapacity?: string;
  ethernetPorts?: number;
  usbPorts?: number;
  simCompatibility?: string;
  dimensions?: string;
  weight?: string;
  color?: string;
  warrantyMonths?: number;
}

export interface PublicProductMedia {
  id: string;
  url: string;
  alt: string;
  title?: string;
  sortOrder: number;
}

export interface PublicFaqItem {
  question: string;
  answer: string;
  sortOrder: number;
}

export interface PublicVariantAvailability {
  inStock: boolean;
  stockKnown: boolean;
}

export interface PublicVariant {
  id: string;
  productId: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  currency: PublicCurrency;
  active: boolean;
  dataPolicy?: 'daily' | 'total';
  dataLimit: string | null;
  duration: string | null;
  durationValue?: number;
  durationUnit?: 'day' | 'month';
  topupDays?: number;
  tripDayOptions?: number[];
  cancellable?: boolean;
  medium: PublicMedium;
  supplier: string;
  fulfillmentMethod: string;
  requiresExistingSim: boolean;
  shippingRequired: boolean;
  stock: number | null;
  availability: PublicVariantAvailability;
  networkLabel?: string;
  apn?: string;
  publicNote?: string;
  coverageLabel?: string;
  speedLabel?: string;
  hotspotSupport?: string;
  activationPolicy?: string;
  resetPolicy?: string;
  installationGuide?: string;
  compatibilityContent?: string;
  apnGuidance?: string;
  instantDeliveryLabel?: string;
  instructions?: string;
  eligibilityNote?: string;
  packageContents?: string;
  deliveryNote?: string;
  simSize?: string;
  deviceSpecifications?: PublicDeviceSpecs;
  deviceSpecs?: PublicDeviceSpecs;
}

export interface PublicPurchaseOption {
  productId: string;
  slug: string;
  action: PublicPurchaseAction;
  operation: Exclude<PublicOperation, 'device_sale'> | 'device_sale';
  medium: Exclude<PublicMedium, null> | null;
  label: string;
  variants: PublicVariant[];
}

export interface PublicPriceSummaryItem {
  currency: string;
  medium?: PublicMedium;
  minPrice: number;
}

export interface PublicProductAvailability {
  hasAvailableVariant: boolean;
}

export interface PublicProductSeo {
  title?: string;
  description?: string;
  keywords?: string;
}

export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  dataPolicy?: 'daily' | 'total';
  packageClass?: 'STANDARD_TRAVEL' | 'PRELOADED' | 'VOICE' | 'DOMESTIC_VN' | 'UNKNOWN';
  operation: PublicOperation;
  medium?: PublicMedium;
  familyProducts?: Array<{ id: string; slug: string; name: string; medium: PublicMedium; operation: PublicOperation }>;
  purchaseOptions?: PublicPurchaseOption[];
  categoryId: string | null;
  categoryPath: Array<{ id: string; slug: string; name: string }>;
  status: 'active';
  coverageType: PublicCoverageType;
  coverageIds: string[];
  coverageDestinations?: Array<{ id: string; name: string }>;
  coverageFilter?: { rawLabel: string; normalizedLabel?: string; id?: string } | Array<{ rawLabel: string; normalizedLabel?: string; id?: string }>;
  primaryImage: string | null;
  primaryMedia?: PublicProductMedia | null;
  image?: string;
  images: string[];
  gallery: PublicProductMedia[];
  description?: string;
  guide?: string;
  networkLabel?: string;
  coverageLabel?: string;
  speedLabel?: string;
  hotspotSupport?: string;
  activationPolicy?: string;
  resetPolicy?: string;
  installationGuide?: string;
  compatibilityContent?: string;
  apnGuidance?: string;
  instantDeliveryLabel?: string;
  instructions?: string;
  eligibilityNote?: string;
  packageContents?: string;
  deliveryNote?: string;
  simSize?: string;
  faqItems: PublicFaqItem[];
  featured: boolean;
  seo: PublicProductSeo;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  deviceSpecs?: PublicDeviceSpecs;
  deviceSpecifications?: PublicDeviceSpecs;
  variantCount: number;
  priceSummary: PublicPriceSummaryItem[];
  availability: PublicProductAvailability;
  deviceGeneration: string[];
  variants: PublicVariant[];
}

export interface PublicCatalogListResponse {
  items: PublicProduct[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets?: {
    categories: Array<{ id: string; slug: string; name: string; count: number }>;
    destinations: Array<{ id: string; name: string; count: number }>;
  };
}

export interface PublicCatalogFilters {
  operation?: PublicOperation;
  category?: string;
  medium?: Exclude<PublicMedium, null>;
  coverage?: string;
  supplier?: string;
  currency?: PublicCurrency;
  inStock?: boolean;
  deviceGeneration?: string;
  page?: number;
  pageSize?: number;
  sort?: 'featured' | 'name' | 'price_asc' | 'price_desc';
  search?: string;
}
