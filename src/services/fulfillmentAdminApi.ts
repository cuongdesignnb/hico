import type { FulfillmentBindingSummary, FulfillmentPreviewResponse } from '../types/fulfillment';

export class FulfillmentAdminApiError extends Error {
  code: string;
  constructor(message: string, code = 'FULFILLMENT_MAPPING_FAILED') {
    super(message);
    this.name = 'FulfillmentAdminApiError';
    this.code = code;
  }
}

const csrf = () => document.cookie.split('; ').find((entry) => entry.startsWith('hico_csrf='))?.split('=').slice(1).join('') ?? '';

const request = async <T>(path: string, init: RequestInit = {}) => {
  const response = await fetch(`/api/admin/catalog/fulfillment${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.method && init.method !== 'GET' ? { 'x-csrf-token': csrf() } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new FulfillmentAdminApiError(body.error || 'Unable to process fulfillment mapping.', body.code);
  return body as T;
};

export const fulfillmentAdminApi = {
  preview: (signal?: AbortSignal) => request<FulfillmentPreviewResponse>('/preview', { signal }),
  approve: (input: { variantId: string; providerOfferId: string; confirmed: true }) => request<{ binding: FulfillmentBindingSummary }>('/bindings', { method: 'POST', body: JSON.stringify(input) }),
  change: (id: string, input: { variantId: string; providerOfferId: string; version: number; confirmed: true }) => request<{ binding: FulfillmentBindingSummary }>(`/bindings/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  revoke: (id: string, version: number) => request<{ binding: FulfillmentBindingSummary }>(`/bindings/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: JSON.stringify({ version, confirmed: true }) }),
};
