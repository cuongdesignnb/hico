import { requestJson } from './catalogWriteApi';
import type { CatalogPublishResponse } from '../types/catalogPublish';

const command = (url: string, body: unknown) => requestJson<CatalogPublishResponse>(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const publishProduct = (productId: string, body: unknown) => command(`/api/admin/catalog/products/${encodeURIComponent(productId)}/publish`, body);
export const unpublishProduct = (productId: string, body: unknown) => command(`/api/admin/catalog/products/${encodeURIComponent(productId)}/unpublish`, body);
export const publishVariant = (variantId: string, body: unknown) => command(`/api/admin/catalog/variants/${encodeURIComponent(variantId)}/publish`, body);
export const unpublishVariant = (variantId: string, body: unknown) => command(`/api/admin/catalog/variants/${encodeURIComponent(variantId)}/unpublish`, body);
