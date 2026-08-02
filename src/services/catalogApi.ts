import type { CatalogProductRecord } from '../types/catalog';

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
  const response = await fetch(url, { signal });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as T;
};

export const getAdminCatalogProducts = (signal?: AbortSignal) => (
  requestJson<CatalogProductRecord[]>('/api/admin/catalog/products', signal)
);

export const getCatalogProducts = (signal?: AbortSignal) => (
  requestJson<CatalogProductRecord[]>('/api/catalog/products', signal)
);

export const getCatalogProduct = (productId: string, signal?: AbortSignal) => (
  requestJson<CatalogProductRecord>(
    `/api/catalog/products/${encodeURIComponent(productId)}`,
    signal,
  )
);
