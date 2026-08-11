import type { CustomerAsset, CustomerAssetList, CustomerAssetSecrets, CustomerAssetSummary } from '../types/customerAsset';

interface ApiError extends Error { code?: string; status?: number; }

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
    const error = new Error(body?.error ?? 'Tài sản Customer chưa sẵn sàng.') as ApiError;
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
};

const list = (path: string, signal?: AbortSignal) => request<CustomerAssetList>(path, { signal });
export const getAssetSummary = (signal?: AbortSignal) => request<CustomerAssetSummary>('/api/customer/assets/summary', { signal });
export const listEsims = (signal?: AbortSignal) => list('/api/customer/esims', signal);
export const getEsim = (esimId: string, signal?: AbortSignal) => request<{ asset: CustomerAsset }>(`/api/customer/esims/${encodeURIComponent(esimId)}`, { signal });
export const revealEsim = (esimId: string, csrfToken: string) => request<CustomerAssetSecrets>(`/api/customer/esims/${encodeURIComponent(esimId)}/reveal`, { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
export const listPhysicalSims = (signal?: AbortSignal) => list('/api/customer/physical-sims', signal);
export const getPhysicalSim = (assetId: string, signal?: AbortSignal) => request<{ asset: CustomerAsset }>(`/api/customer/physical-sims/${encodeURIComponent(assetId)}`, { signal });
export const listDevices = (signal?: AbortSignal) => list('/api/customer/devices', signal);
export const getDevice = (assetId: string, signal?: AbortSignal) => request<{ asset: CustomerAsset }>(`/api/customer/devices/${encodeURIComponent(assetId)}`, { signal });
export const listTopups = (signal?: AbortSignal) => list('/api/customer/topups', signal);
export const getTopup = (topupId: string, signal?: AbortSignal) => request<{ asset: CustomerAsset }>(`/api/customer/topups/${encodeURIComponent(topupId)}`, { signal });
