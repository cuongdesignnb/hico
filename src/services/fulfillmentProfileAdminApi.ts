import type { FulfillmentProfile, FulfillmentProfilePreviewResponse } from '../types/fulfillmentProfile';

export class FulfillmentProfileAdminApiError extends Error {
  code: string;
  constructor(message: string, code = 'FULFILLMENT_PROFILE_FAILED') {
    super(message);
    this.name = 'FulfillmentProfileAdminApiError';
    this.code = code;
  }
}

const csrf = () => document.cookie.split('; ').find((entry) => entry.startsWith('hico_csrf='))?.split('=').slice(1).join('') ?? '';

const request = async <T>(path: string, init: RequestInit = {}) => {
  const response = await fetch(`/api/admin/catalog/fulfillment/profiles${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.method && init.method !== 'GET' ? { 'x-csrf-token': csrf() } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new FulfillmentProfileAdminApiError(body.error || 'Unable to process fulfillment profile.', body.code);
  return body as T;
};

export interface FulfillmentProfileInput {
  variantId: string;
  provider: 'WORLDMOVE';
  regionCode: string;
  medium: 'ESIM' | 'PHYSICAL_SIM';
  dataPolicy: string;
  speedPolicy: string;
  networkPolicy: string;
  activationPolicy: string;
  resetPolicy: string;
  operationType: string;
  durationDays: number;
  source: string;
  confirmed: true;
  version?: number;
}

export const fulfillmentProfileAdminApi = {
  preview: () => request<FulfillmentProfilePreviewResponse>('/preview'),
  approve: (input: FulfillmentProfileInput) => request<{ profile: FulfillmentProfile }>('', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: FulfillmentProfileInput) => request<{ profile: FulfillmentProfile }>(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  revoke: (id: string, version: number) => request<{ profile: FulfillmentProfile }>(`/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: JSON.stringify({ version, confirmed: true }) }),
};
