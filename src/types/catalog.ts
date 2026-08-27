export type ProductOperation =
  | 'new_subscription'
  | 'topup'
  | 'device_sale';

export type CatalogCategoryKind = 'esim' | 'physical_sim' | 'topup' | 'device' | 'accessory';

export interface CatalogCategoryPathItem {
  id: string;
  slug: string;
  name: string;
}

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  kind: CatalogCategoryKind | null;
  sortOrder: number;
  status: 'active' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
  path?: CatalogCategoryPathItem[];
  productCount?: number;
}

export type CoverageType =
  | 'country'
  | 'region'
  | 'global'
  | 'not_applicable';

export type CatalogStatus =
  | 'active'
  | 'draft'
  | 'archived';

export type CatalogDataPolicy = 'daily' | 'total';

export type SimMedium =
  | 'esim'
  | 'physical_sim'
  | null;

export type Supplier =
  | 'worldmove'
  | 'local_carrier'
  | 'hico'
  | 'other';

export type FulfillmentMethod =
  | 'WORLDMOVE_ESIM_REDEEM'
  | 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM'
  | 'WORLDMOVE_PHYSICAL_ORDER'
  | 'WORLDMOVE_TOPUP'
  | 'HICO_MANUAL_QR'
  | 'HICO_PHYSICAL_STOCK'
  | 'EXTERNAL_PROVIDER_API'
  | 'MANUAL_PROCESSING';

export interface CoverageDestination {
  id: string;
  isoCode: string;
  mcc?: string;
  name: string;
  dataPolicy?: CatalogDataPolicy;
  flag: string;
  regionId?: string;
  image?: string;
  networks: string[];
  guide?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  operation: ProductOperation;
  medium?: SimMedium;
  packageFamilyKey?: string;
  packageClass?: 'STANDARD_TRAVEL' | 'PRELOADED' | 'VOICE' | 'DOMESTIC_VN' | 'UNKNOWN';
  sourceCategoryLabel?: string;
  operationResolution?: 'RESOLVED' | 'UNRESOLVED';
  coverageFilter?: { rawLabel: string; normalizedLabel?: string; id?: string } | Array<{ rawLabel: string; normalizedLabel?: string; id?: string }>;
  dataPolicy?: CatalogDataPolicy;
  categoryId?: string | null;
  categoryPath?: CatalogCategoryPathItem[];
  categoryNeedsReview?: boolean;
  coverageType: CoverageType;
  coverageIds: string[];
  image?: string;
  primaryMediaId?: string | null;
  images?: Array<{ id: string; url: string; alt?: string; title?: string; sortOrder?: number }>;
  gallery?: Array<{ id: string; url: string; alt?: string; title?: string; sortOrder?: number }>;
  galleryMediaIds?: string[];
  description?: string;
  guide?: string;
  featured: boolean;
  status: CatalogStatus;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  deviceSpecifications?: CatalogDeviceSpecs;
  deviceSpecs?: CatalogDeviceSpecs;
  networkLabel?: string;
  publicNote?: string;
  coverageLabel?: string;
  rawCoverageLabels?: string[];
  coverageDestinations?: Array<{ id: string; name: string }>;
  coverageStatus?: 'RESOLVED' | 'MISSING' | 'CARRIER_ONLY' | 'UNKNOWN_DESTINATION' | 'PARTIAL' | 'UNRESOLVED';
  coverageNeedsReview?: boolean;
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
  faqItems?: Array<{ question: string; answer: string; sortOrder?: number }>;
  publishedAt?: string;
  legacySource?: 'destination' | 'package' | 'mysql';
  legacyId?: string | number;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogVariant {
  id: string;
  productId: string;
  sku: string;
  publicSku?: string;
  dataLimit?: string;
  dataPolicy?: CatalogDataPolicy;
  duration?: string;
  durationValue?: number;
  durationUnit?: 'day' | 'month';
  tripDayOptions?: number[];
  cancellable?: boolean;
  price: number;
  compareAtPrice?: number | null;
  currency: 'VND' | 'USD';
  medium: SimMedium;
  packageFamilyKey?: string;
  operationResolution?: 'RESOLVED' | 'UNRESOLVED';
  supplier: Supplier;
  fulfillmentMethod: FulfillmentMethod;
  providerOfferId?: string;
  wmproductId?: string;
  providerProductId?: string;
  leSIM?: boolean | null;
  providerProductType?: 0 | 1 | 2 | null;
  requiresExistingSim: boolean;
  shippingRequired?: boolean;
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
  deviceSpecifications?: CatalogDeviceSpecs;
  deviceSpecs?: CatalogDeviceSpecs;
  stock?: number | null;
  active: boolean;
  needsReview?: boolean;
  archived?: boolean;
  skuConflict?: boolean;
  legacySimType?: string;
  reconciliationStatus?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  legacySource?: string;
  legacyId?: string | number;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogDeviceSpecs {
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

export interface CatalogProductRecord extends CatalogProduct {
  variants: CatalogVariant[];
}

export interface CatalogAdminVariantSummary {
  id: string;
  productId: string;
  sku: string;
  wmproductId?: string | null;
  price: number;
  compareAtPrice?: number | null;
  currency: 'VND' | 'USD';
  medium: SimMedium;
  supplier: Supplier;
  fulfillmentMethod: FulfillmentMethod;
  active: boolean;
  needsReview: boolean;
  archived: boolean;
  stock?: number | null;
  duration?: string | null;
  durationValue?: number | null;
  durationUnit?: 'day' | 'month' | null;
  tripDayOptions?: number[];
  operationResolution?: 'RESOLVED' | 'UNRESOLVED' | null;
}

export interface CatalogAdminProductSummary extends Omit<CatalogProduct, 'variants'> {
  variantCount: number;
  needsReviewCount: number;
  variantIds: string[];
  variants: CatalogAdminVariantSummary[];
}

export interface AdminCatalogListResponse {
  items: CatalogAdminProductSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    products: number;
    variants: number;
    needsReview: number;
  };
  catalogVersionId: string | null;
}
