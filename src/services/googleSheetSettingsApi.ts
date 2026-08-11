import type { GoogleSheetConnectionTestResult, GoogleSheetDiscoveryResult, GoogleSheetHeaderDiscoveryResult, GoogleSheetSettingsErrorBody, GoogleSheetSettingsStatus } from '../types/googleSheetSettings';

export class GoogleSheetSettingsApiError extends Error {
  code: string;
  constructor(message: string, code = 'GOOGLE_SHEET_SETTINGS_FAILED') { super(message); this.name = 'GoogleSheetSettingsApiError'; this.code = code; }
}

const csrf = () => document.cookie.split('; ').find((entry) => entry.startsWith('hico_csrf='))?.split('=').slice(1).join('') ?? '';
const basePath = '/api/admin/settings/integrations/google-sheet';
const request = async <T>(path = '', init: RequestInit = {}) => {
  const response = await fetch(`${basePath}${path}`, {
    credentials: 'include', ...init,
    headers: { 'content-type': 'application/json', ...(init.method && init.method !== 'GET' ? { 'x-csrf-token': csrf() } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => ({})) as GoogleSheetSettingsErrorBody;
  if (!response.ok) throw new GoogleSheetSettingsApiError(body.error || 'Không thể xử lý tích hợp Google Sheet.', body.code);
  return body as T;
};

export const googleSheetSettingsApi = {
  get: () => request<GoogleSheetSettingsStatus>(),
  save: (input: Record<string, unknown>) => request<GoogleSheetSettingsStatus>('', { method: 'PUT', body: JSON.stringify(input) }),
  replaceCredential: (input: { credential: string; currentPassword: string; version: number }) => request<{ settings: GoogleSheetSettingsStatus; test: GoogleSheetConnectionTestResult }>('/credential', { method: 'PUT', body: JSON.stringify(input) }),
  test: (input: Record<string, unknown> = {}) => request<GoogleSheetConnectionTestResult>('/test', { method: 'POST', body: JSON.stringify(input) }),
  discover: (spreadsheetId: string) => request<GoogleSheetDiscoveryResult>('/discover', { method: 'POST', body: JSON.stringify({ spreadsheetId }) }),
  discoverHeader: (input: { spreadsheetId: string; sheetId: number; sheetTitle: string; headerRow: number; maxColumns?: number }) => request<GoogleSheetHeaderDiscoveryResult>('/discover-header', { method: 'POST', body: JSON.stringify(input) }),
  validateRange: (input: { spreadsheetId: string; sheetTitle: string; range: string; headerRow: number; maxRowsPerBatch?: number }) => request<{ valid: true; checkedAt: string }>('/validate-range', { method: 'POST', body: JSON.stringify(input) }),
  revoke: (input: { currentPassword: string; version: number }) => request<GoogleSheetSettingsStatus>('/credential', { method: 'DELETE', body: JSON.stringify(input) }),
  preview: () => request<{ batch: { id: string; status: string; summary?: Record<string, number> }; rows: unknown[]; idempotent?: boolean }>('/preview', { method: 'POST', body: '{}' }),
};
