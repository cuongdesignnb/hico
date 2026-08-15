import type {
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
} from '../types/catalog';
import type { ProductReadinessResult } from '../types/productWizard';

export class CatalogWriteApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'CatalogWriteApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const getErrorMessage = (payload: unknown) => (
  typeof payload === 'object'
  && payload !== null
  && 'error' in payload
  && typeof payload.error === 'string'
    ? payload.error
    : 'Không thể xử lý catalog.'
);

const getErrorMeta = (payload: unknown) => {
  if (typeof payload !== 'object' || payload === null) return {};
  const record = payload as { code?: unknown; details?: unknown };
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    details: record.details,
  };
};

export const requestJson = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'include',
      signal: init.signal ?? controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const meta = getErrorMeta(payload);
      throw new CatalogWriteApiError(getErrorMessage(payload), response.status, meta.code, meta.details);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof CatalogWriteApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CatalogWriteApiError('Yêu cầu quá thời gian. Hãy kiểm tra kết nối và thử lại.', 408, 'TIMEOUT');
    }
    throw new CatalogWriteApiError('Không thể kết nối máy chủ catalog.', 0, 'NETWORK_ERROR');
  } finally {
    window.clearTimeout(timeout);
  }
};

export interface CatalogCommandResponse<T> {
  catalogVersionId: string;
  warnings?: Array<{ code?: string; message: string }>;
  product?: T extends CatalogProduct ? T : never;
  variant?: T extends CatalogVariant ? T : never;
  deleted?: boolean;
}

const commandInit = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const createProduct = (body: unknown) => requestJson<CatalogCommandResponse<CatalogProduct>>(
  '/api/admin/catalog/products',
  commandInit(body),
);

export const getProduct = (productId: string, signal?: AbortSignal) => requestJson<{
  product: CatalogProduct;
  variants: CatalogVariant[];
  catalogVersionId: string;
}>(`/api/admin/catalog/products/${encodeURIComponent(productId)}`, { signal });

export const updateProduct = (productId: string, body: unknown) => requestJson<CatalogCommandResponse<CatalogProduct>>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}`,
  { ...commandInit(body), method: 'PUT' },
);

export const archiveProduct = (productId: string, body: unknown) => requestJson<CatalogCommandResponse<CatalogProduct>>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}/archive`,
  commandInit(body),
);

export const restoreProduct = (productId: string, body: unknown) => requestJson<CatalogCommandResponse<CatalogProduct>>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}/restore`,
  commandInit(body),
);

export const deleteProduct = (productId: string, body: unknown) => requestJson<CatalogCommandResponse<CatalogProduct>>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}`,
  { ...commandInit(body), method: 'DELETE' },
);

export const createVariant = (productId: string, body: unknown) => requestJson<CatalogCommandResponse<CatalogVariant>>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}/variants`,
  commandInit(body),
);

export const updateVariant = (productId: string, variantId: string, body: unknown) => requestJson<CatalogCommandResponse<CatalogVariant>>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
  { ...commandInit(body), method: 'PUT' },
);

export const archiveVariant = (productId: string, variantId: string, body: unknown) => requestJson<CatalogCommandResponse<CatalogVariant>>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/archive`,
  commandInit(body),
);

export const restoreVariant = (productId: string, variantId: string, body: unknown) => requestJson<CatalogCommandResponse<CatalogVariant>>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/restore`,
  commandInit(body),
);

export const deleteVariant = (productId: string, variantId: string, body: unknown) => requestJson<CatalogCommandResponse<CatalogVariant>>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
  { ...commandInit(body), method: 'DELETE' },
);

export const validateProduct = (productId: string) => requestJson<ProductReadinessResult>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}/validate`,
  commandInit({}),
);

export const getProductReadiness = (productId: string) => requestJson<ProductReadinessResult>(
  `/api/admin/catalog/products/${encodeURIComponent(productId)}/publish-readiness`,
  commandInit({}),
);

export const getVariantReadiness = (variantId: string) => requestJson<ProductReadinessResult>(
  `/api/admin/catalog/variants/${encodeURIComponent(variantId)}/publish-readiness`,
  commandInit({}),
);

export const getCatalogSourceStatus = () => requestJson<import('../types/productWizard').CatalogSourceStatus>(
  '/api/admin/catalog/source-status',
);

export const getCatalogVersions = () => requestJson<unknown[]>('/api/admin/catalog/versions');

export interface CatalogCategoriesResponse {
  items: CatalogCategory[];
  unresolvedCount: number;
  catalogVersionId: string;
}

export const getAdminCategories = (signal?: AbortSignal) => requestJson<CatalogCategoriesResponse>(
  '/api/admin/catalog/categories',
  { signal },
);

export const createCategory = (body: unknown) => requestJson<{ category: CatalogCategory; catalogVersionId: string }>(
  '/api/admin/catalog/categories',
  commandInit(body),
);

export const updateCategory = (categoryId: string, body: unknown) => requestJson<{ category: CatalogCategory; catalogVersionId: string }>(
  `/api/admin/catalog/categories/${encodeURIComponent(categoryId)}`,
  { ...commandInit(body), method: 'PUT' },
);

export const setCategoryArchived = (categoryId: string, archived: boolean, body: unknown) => requestJson<{ category: CatalogCategory; catalogVersionId: string }>(
  `/api/admin/catalog/categories/${encodeURIComponent(categoryId)}/${archived ? 'archive' : 'restore'}`,
  commandInit(body),
);

export const getCategoryBackfillPreview = (signal?: AbortSignal) => requestJson<{
  assigned: number;
  unresolved: number;
  unchanged: number;
  publicSkusAssigned: number;
  catalogVersionId: string;
}>('/api/admin/catalog/category-backfill/preview', { signal });
