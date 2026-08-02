import type { CatalogStatus, ProductOperation, SimMedium, Supplier } from './catalog';

export type BulkEntityType = 'product' | 'variant';
export type BulkSelection =
  | { mode: 'ids'; ids: string[] }
  | { mode: 'filter'; filter: BulkFilter; excludedIds: string[] };

export interface BulkFilter {
  search?: string;
  operation?: ProductOperation;
  supplier?: Supplier;
  medium?: Exclude<SimMedium, null>;
  status?: CatalogStatus;
  needsReview?: boolean;
  active?: boolean;
  archived?: boolean;
  currency?: 'VND' | 'USD';
}

export type BulkOperation =
  | { type: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE' | 'SET_FEATURED' | 'UNSET_FEATURED' | 'RUN_READINESS' }
  | { type: 'ADJUST_PRICE'; mode: 'percent' | 'fixed'; value: number; currency?: 'VND' | 'USD' }
  | { type: 'SET_PRICE'; value: number; currency?: 'VND' | 'USD' }
  | { type: 'SET_COMPARE_PRICE'; value: number; currency?: 'VND' | 'USD' }
  | { type: 'CLEAR_COMPARE_PRICE'; currency?: 'VND' | 'USD' }
  | { type: 'SET_PROVIDER_MAPPING'; providerOfferId: string }
  | { type: 'CLEAR_PROVIDER_MAPPING' }
  | { type: 'SET_FULFILLMENT_SOURCE'; source: 'hico_manual_qr' | 'hico_physical_stock' | 'manual_processing' };

export interface BulkRequest {
  idempotencyKey: string;
  catalogVersionId: string;
  entityType: BulkEntityType;
  selection: BulkSelection;
  operation: BulkOperation;
}

export interface BulkChange {
  id: string;
  productId?: string;
  label: string;
  changedFields: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface BulkErrorItem {
  id: string;
  errors: Array<{ code: string; message: string }>;
}

export interface BulkPreviewResponse {
  previewId: string;
  catalogVersionId: string;
  selectionHash: string;
  matchedCount: number;
  eligible: number;
  blocked: number;
  warnings: Array<{ code?: string; message: string }>;
  changes: BulkChange[];
  errors: BulkErrorItem[];
  expiresAt: string;
}

export interface BulkExecuteResponse {
  previewId: string;
  catalogVersionId: string;
  affectedCount: number;
  changes: BulkChange[];
  warnings: Array<{ code?: string; message: string }>;
}
