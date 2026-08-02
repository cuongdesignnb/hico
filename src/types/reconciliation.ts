import type { ProviderOffer, ProviderProductType } from './provider';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'NOT_FOUND'
  | 'DUPLICATE_PROVIDER_OFFER'
  | 'TYPE_CONFLICT'
  | 'LEGACY_CONFLICT'
  | 'MISSING_WMPRODUCT_ID'
  | 'INACTIVE_PROVIDER_OFFER'
  | 'NEEDS_REVIEW'
  | 'CONFIRMED_BY_ADMIN'
  | 'IGNORED_BY_ADMIN';

export type ReconciliationResolution =
  | 'WORLDMOVE_ESIM_REDEEM'
  | 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM'
  | 'WORLDMOVE_PHYSICAL_ORDER'
  | 'WORLDMOVE_TOPUP'
  | 'HICO_MANUAL_QR'
  | 'HICO_PHYSICAL_STOCK'
  | 'MANUAL_PROCESSING';

export interface ReconciliationRecord {
  productId: string;
  variantId: string;
  sku: string;
  wmproductId?: string;
  providerOfferId?: string;
  status: ReconciliationStatus;
  suggestedResolution?: ReconciliationResolution;
  confirmedResolution?: ReconciliationResolution;
  reason: string;
  reviewedBy?: string;
  reviewedAt?: string;
  providerSnapshotHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationSummary {
  total: number;
  matched: number;
  needsReview: number;
  notFound: number;
  missingWmproductId: number;
  duplicateProviderOffer: number;
  typeConflict: number;
  legacyConflict: number;
  conflicts: number;
  inactiveProviderOffer: number;
  confirmedByAdmin: number;
  ignoredByAdmin: number;
}

export type ReconciliationProviderOffer = Omit<
  ProviderOffer,
  'provider' | 'providerProductLanguage' | 'cEndPrice' | 'cEndVisible' | 'rawHash'
>;

export interface ReconciliationItem extends ReconciliationRecord {
  productName: string;
  productOperation?: 'new_subscription' | 'topup' | 'device_sale';
  variantMedium?: 'esim' | 'physical_sim' | null;
  providerOffers: ReconciliationProviderOffer[];
}

export interface ReconciliationListResponse {
  items: ReconciliationItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReconciliationRunResult {
  created: number;
  updated: number;
  unchanged: number;
  adminConfirmedPreserved: number;
  summary: ReconciliationSummary;
}

export interface ReconciliationFiltersState {
  status: ReconciliationStatus | 'all';
  search: string;
  providerProductType?: ProviderProductType;
  leSIM?: boolean;
}

export interface ReconciliationUpdateRequest {
  resolution?: ReconciliationResolution;
  providerOfferId?: string;
  action?: 'IGNORE';
  reviewedBy?: string;
}
