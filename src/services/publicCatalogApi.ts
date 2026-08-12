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

const PUBLIC_CATALOG_TTL_MS = 30_000;
const catalogCache = new Map<string, { expiresAt: number; value?: PublicCatalogListResponse; promise?: Promise<PublicCatalogListResponse> }>();

const withAbort = <T>(promise: Promise<T>, signal?: AbortSignal) => new Promise<T>((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('The operation was aborted.', 'AbortError'));
    return;
  }
  let settled = false;
  const abort = () => {
    if (settled) return;
    settled = true;
    reject(new DOMException('The operation was aborted.', 'AbortError'));
  };
  signal?.addEventListener('abort', abort, { once: true });
  promise.then((value) => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener('abort', abort);
    resolve(value);
  }, (error) => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener('abort', abort);
    reject(error);
  });
});

const getCachedCatalog = (url: string) => {
  const now = Date.now();
  const cached = catalogCache.get(url);
  if (cached && cached.expiresAt > now && (cached.value || cached.promise)) return cached;
  const promise = requestJson<PublicCatalogListResponse>(url).then((value) => {
    catalogCache.set(url, { value, expiresAt: Date.now() + PUBLIC_CATALOG_TTL_MS });
    return value;
  }).catch((error) => {
    if (catalogCache.get(url)?.promise === promise) catalogCache.delete(url);
    throw error;
  });
  catalogCache.set(url, { promise, expiresAt: now + PUBLIC_CATALOG_TTL_MS });
  while (catalogCache.size > 24) catalogCache.delete(catalogCache.keys().next().value as string);
  return { promise, expiresAt: now + PUBLIC_CATALOG_TTL_MS };
};

export const clearPublicCatalogCache = () => catalogCache.clear();

export const getPublicCatalog = (filters: PublicCatalogFilters = {}, signal?: AbortSignal) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const url = `/api/catalog/products${params.toString() ? `?${params.toString()}` : ''}`;
  const cached = getCachedCatalog(url);
  if (cached.value) return Promise.resolve(cached.value);
  return withAbort(cached.promise as Promise<PublicCatalogListResponse>, signal);
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
