export type FulfillmentStrategy = 'EXACT' | 'MAPPED_FALLBACK' | 'NEXT_LONGER' | null;

export interface FulfillmentOfferSummary {
  id: string;
  wmproductId: string;
  providerProductId?: string | null;
  providerProductName?: string | null;
  productRegion?: string | null;
  providerProductType?: number | null;
  leSIM?: boolean | null;
  medium?: string | null;
  durationDays?: number | null;
  providerCost?: number | null;
  providerCurrency?: string | null;
  active: boolean;
  snapshotHash?: string | null;
}

export interface FulfillmentBindingSummary {
  id: string;
  providerOfferId: string;
  providerDays: number;
  upgradeDays: number;
  version: number;
  status: 'ACTIVE' | 'REVOKED';
  strategy: 'MAPPED_FALLBACK';
  snapshotHash?: string | null;
}

export interface FulfillmentPreviewItem {
  productId: string;
  productName: string;
  variantId: string;
  sku?: string | null;
  requestedDays?: number | null;
  medium?: string | null;
  familyKey?: string | null;
  strategy: FulfillmentStrategy;
  code: string;
  status: string;
  warnings: string[];
  providerDays?: number | null;
  upgradeDays?: number | null;
  providerOffer: FulfillmentOfferSummary | null;
  exactOffer: FulfillmentOfferSummary | null;
  nextLongerOffer: FulfillmentOfferSummary | null;
  fallbackOffers: FulfillmentOfferSummary[];
  binding: FulfillmentBindingSummary | null;
  margin?: { status: string; marginAmount: number | null; marginPercent: number | null };
}

export interface FulfillmentPreviewResponse {
  items: FulfillmentPreviewItem[];
  total: number;
  generatedAt: string;
}
