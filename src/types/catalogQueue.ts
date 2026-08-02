export interface QueueResponse<T> {
  total: number;
  offset: number;
  limit: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface SkuConflictGroup {
  groupId: string;
  sku: string;
  normalizedSku: string;
  variantCount: number;
  variants: Array<{ id: string; sku: string; productId: string; productName: string | null; active: boolean; archived: boolean; needsReview: boolean }>;
}

export interface NeedsReviewItem {
  id: string;
  sku: string;
  productId: string;
  productName: string | null;
  status: string;
  needsReview: boolean;
  fulfillmentSource: string;
}

export interface ProviderIssueItem {
  id: string;
  sku: string;
  productId: string;
  productName: string | null;
  issueCode: string;
  issueMessage: string;
  providerOfferId: string | null;
}

export interface InventoryWarningItem {
  id: string;
  code: string;
  variantId: string;
  sku?: string;
  productName?: string | null;
  stock?: number;
  message: string;
}
