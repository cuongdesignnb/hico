import type { PublicCatalogFilters, PublicCatalogListResponse, PublicProduct, PublicVariant } from '../types/publicCatalog';

const readError = async (response: Response) => {
  const payload = await response.json().catch(() => null) as { error?: string; code?: string } | null;
  const error = new Error(payload?.error || 'Không thể tải danh mục sản phẩm.') as Error & { code?: string; status?: number };
  error.code = payload?.code;
  error.status = response.status;
  return error;
};

const requestJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<T>;
};

export const getPublicCatalog = (filters: PublicCatalogFilters = {}, signal?: AbortSignal) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return requestJson<PublicCatalogListResponse>(`/api/catalog/products${params.toString() ? `?${params.toString()}` : ''}`, signal);
};

export const getPublicProducts = (filters: PublicCatalogFilters = {}, signal?: AbortSignal) => (
  getPublicCatalog(filters, signal).then((result) => result.items)
);

export const getPublicProductBySlug = (slug: string, signal?: AbortSignal) => (
  requestJson<PublicProduct | { redirect: string; permanent: true }>(`/api/catalog/products/by-slug/${encodeURIComponent(slug)}`, signal)
);

export const getPublicProductById = (productId: string, signal?: AbortSignal) => (
  requestJson<PublicProduct>(`/api/catalog/products/${encodeURIComponent(productId)}`, signal)
);

export const getPublicProductVariants = (productId: string, signal?: AbortSignal) => (
  requestJson<{ items: PublicVariant[] }>(`/api/catalog/products/${encodeURIComponent(productId)}/variants`, signal)
    .then((result) => result.items)
);
