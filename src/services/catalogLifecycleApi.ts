import type { CatalogMaintenanceStatus, CatalogResetPreview, CatalogResetResult } from '../types/catalogLifecycle';
import type { CatalogSheetSyncBatch, CatalogSheetSyncRow } from '../types/catalogSheetSync';
import type { CatalogPreviewJob, CatalogPreviewJobMode } from '../types/catalogPreviewJob';

export class CatalogLifecycleApiError extends Error {
  code: string;
  details?: unknown;
  constructor(message: string, code = 'CATALOG_LIFECYCLE_FAILED', details?: unknown) { super(message); this.name = 'CatalogLifecycleApiError'; this.code = code; this.details = details; }
}

const csrf = () => document.cookie.split('; ').find((entry) => entry.startsWith('hico_csrf='))?.split('=').slice(1).join('') ?? '';
const request = async <T>(path: string, init: RequestInit = {}) => {
  const response = await fetch(`/api${path}`, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init.method && init.method !== 'GET' ? { 'x-csrf-token': csrf() } : {}), ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new CatalogLifecycleApiError(body.error || 'Không thể xử lý catalog.', body.code, body.details);
  return body as T;
};

export const catalogLifecycleApi = {
  maintenanceStatus: () => request<CatalogMaintenanceStatus>('/admin/catalog/maintenance/status'),
  resetPreview: () => request<CatalogResetPreview>('/admin/catalog/reset/preview'),
  reset: (input: { catalogVersionId: string; confirmation: string; currentPassword: string; idempotencyKey: string }) => request<CatalogResetResult>('/admin/catalog/reset', { method: 'POST', body: JSON.stringify(input) }),
  startPreview: (mode: CatalogPreviewJobMode) => request<{ job: CatalogPreviewJob }>('/admin/catalog-sheet-sync/preview-jobs', { method: 'POST', body: JSON.stringify({ mode }) }),
  getPreviewJob: (jobId: string) => request<{ job: CatalogPreviewJob }>(`/admin/catalog-sheet-sync/preview-jobs/${encodeURIComponent(jobId)}`),
  cancelPreviewJob: (jobId: string) => request<{ job: CatalogPreviewJob }>(`/admin/catalog-sheet-sync/preview-jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST', body: '{}' }),
  fullPreview: () => request<{ job: CatalogPreviewJob }>('/admin/catalog-sheet-sync/full-preview', { method: 'POST', body: '{}' }),
  fullApply: (batchId: string, currentPassword: string) => request<{ batch: CatalogSheetSyncBatch; rows: CatalogSheetSyncRow[]; versionId: string }>('/admin/catalog-sheet-sync/' + encodeURIComponent(batchId) + '/full-apply', { method: 'POST', body: JSON.stringify({ currentPassword }) }),
};
