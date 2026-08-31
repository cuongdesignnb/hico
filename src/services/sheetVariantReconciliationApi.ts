export interface ReconciliationCandidate {
  candidateId: string;
  batchId: string;
  sheetRowNumber: number;
  sheetName: string | null;
  medium: 'esim' | 'physical_sim' | null;
  sheetSku: string | null;
  normalizedSheetSku: string;
  wmproductId: string | null;
  price: number | null;
  durationDays: number | null;
  dataType: string | null;
  apn: string | null;
  networkLabel: string | null;
  status: string;
  errors: Array<{ code: string; field?: string }>;
  variantId: string | null;
}
export interface SuggestedVariant { product: { id: string; slug: string; name?: string; status?: string } | null; variant: { id: string; sku: string; medium: string; price: number; currency: string; durationDays: number | null; providerOfferId: string | null; wmproductId: string | null; archived: boolean }; evidence: Array<{ type: string; strength?: string; providerOfferId?: string | null }>; warnings: Array<{ code: string; reason: string }> }
export class SheetVariantReconciliationApiError extends Error { code: string; constructor(message: string, code = 'RECONCILIATION_FAILED') { super(message); this.name = 'SheetVariantReconciliationApiError'; this.code = code; } }
const csrf = () => document.cookie.split('; ').find((entry) => entry.startsWith('hico_csrf='))?.split('=').slice(1).join('') ?? '';
const request = async <T>(path: string, init: RequestInit = {}) => { const response = await fetch(`/api/admin${path}`, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init.method && init.method !== 'GET' ? { 'x-csrf-token': csrf() } : {}), ...init.headers } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new SheetVariantReconciliationApiError(body.error || 'Unable to process reconciliation.', body.code); return body as T; };
export const sheetVariantReconciliationApi = {
  unmatched: () => request<{ items: ReconciliationCandidate[] }>('/catalog/sheet-reconciliation/unmatched'),
  candidates: (candidateId: string) => request<{ candidate: ReconciliationCandidate; canonicalCandidates: SuggestedVariant[]; conflicts: Array<{ code: string; reason: string }> }>(`/catalog/sheet-reconciliation/${encodeURIComponent(candidateId)}/candidates`),
  createAlias: (input: { namespace: string; externalKey: string; medium: string; variantId: string }) => request<{ alias: { id: string; version: number } }>('/catalog/variant-aliases', { method: 'POST', body: JSON.stringify(input) }),
};
