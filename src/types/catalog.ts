export type ProductOperation =
  | 'new_subscription'
  | 'topup'
  | 'device_sale';

export type CoverageType =
  | 'country'
  | 'region'
  | 'global'
  | 'not_applicable';

export type CatalogStatus =
  | 'active'
  | 'draft'
  | 'archived';

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
  coverageType: CoverageType;
  coverageIds: string[];
  image?: string;
  description?: string;
  guide?: string;
  featured: boolean;
  status: CatalogStatus;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
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
  dataLimit?: string;
  duration?: string;
  price: number;
  compareAtPrice?: number | null;
  currency: 'VND' | 'USD';
  medium: SimMedium;
  supplier: Supplier;
  fulfillmentMethod: FulfillmentMethod;
  providerOfferId?: string;
  wmproductId?: string;
  providerProductId?: string;
  leSIM?: boolean | null;
  providerProductType?: 0 | 1 | 2 | null;
  requiresExistingSim: boolean;
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
  // Public content metadata (maps to PDP feature cards)
  networkLabel?: string;
  activationPolicy?: string;
  hotspotSupport?: string; // 'true'=yes, 'false'=no
}

export interface CatalogProductRecord extends CatalogProduct {
  variants: CatalogVariant[];
}
