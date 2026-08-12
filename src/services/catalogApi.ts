import type { AdminCatalogListResponse, CatalogProductRecord } from '../types/catalog';

export interface AdminCatalogFilters {
  search?: string;
  operation?: string;
  coverage?: string;
  medium?: string;
  supplier?: string;
  page?: number;
  pageSize?: number;
}

const getErrorMessage = (payload: unknown) => {
  if (
    typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  return 'Không thể tải danh mục sản phẩm.';
};

const requestJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal, credentials: 'include' });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as T;
};

export const getAdminCatalogProducts = (filters: AdminCatalogFilters = {}, signal?: AbortSignal) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return requestJson<AdminCatalogListResponse>(`/api/admin/catalog/products${params.toString() ? `?${params.toString()}` : ''}`, signal);
};

export const getCatalogProducts = (signal?: AbortSignal) => (
  requestJson<CatalogProductRecord[]>('/api/catalog/products', signal)
);

export const getCatalogProduct = (productId: string, signal?: AbortSignal) => (
  requestJson<CatalogProductRecord>(
    `/api/catalog/products/${encodeURIComponent(productId)}`,
    signal,
  )
);
