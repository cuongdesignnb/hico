import type { CatalogSheetSyncBatch, CatalogSheetSyncField, CatalogSheetSyncRow } from '../types/catalogSheetSync';

export class CatalogSheetSyncApiError extends Error {
  code: string;
  constructor(message: string, code = 'SHEET_SYNC_FAILED') { super(message); this.name = 'CatalogSheetSyncApiError'; this.code = code; }
}

const csrf = () => document.cookie.split('; ').find((entry) => entry.startsWith('hico_csrf='))?.split('=').slice(1).join('') ?? '';
const request = async <T>(path: string, init: RequestInit = {}) => {
  const response = await fetch(`/api/admin/catalog-sheet-sync${path}`, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init.method && init.method !== 'GET' ? { 'x-csrf-token': csrf() } : {}), ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new CatalogSheetSyncApiError(body.error || 'Không thể xử lý đồng bộ Google Sheet.', body.code);
  return body as T;
};
export const catalogSheetSyncApi = {
  preview: () => request<{ batch: CatalogSheetSyncBatch; rows: CatalogSheetSyncRow[] }>('/preview', { method: 'POST' }),
  quickPreview: () => request<{ batch: CatalogSheetSyncBatch; rows: CatalogSheetSyncRow[] }>('/quick-preview', { method: 'POST', body: '{}' }),
  apply: (batchId: string, selection: { rowIds?: string[]; fields?: CatalogSheetSyncField[] }) => request<{ batch: CatalogSheetSyncBatch; rows: CatalogSheetSyncRow[] }>(`/${encodeURIComponent(batchId)}/apply`, { method: 'POST', body: JSON.stringify({ selection }) }),
  quickApply: (batchId: string, rowIds?: string[]) => request<{ batch: CatalogSheetSyncBatch; rows: CatalogSheetSyncRow[] }>(`/${encodeURIComponent(batchId)}/quick-apply`, { method: 'POST', body: JSON.stringify({ rowIds }) }),
  reject: (batchId: string) => request<{ batch: CatalogSheetSyncBatch }>(`/${encodeURIComponent(batchId)}/reject`, { method: 'POST', body: '{}' }),
};
