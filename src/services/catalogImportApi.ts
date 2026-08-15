import { requestJson } from './catalogWriteApi';
import type { CatalogImportColumnMap, CatalogImportPreview, CatalogImportSourceMode } from '../types/catalogImport';

export const previewCatalogImport = (body: { catalogVersionId: string; categoryId: string; sourceMode: CatalogImportSourceMode; text: string; columnMap: CatalogImportColumnMap }) => requestJson<CatalogImportPreview>('/api/admin/catalog/import/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const executeCatalogImport = (body: { previewId: string; catalogVersionId: string; confirm: true; idempotencyKey: string }) => requestJson<{ productsCreated: number; variantsCreated: number; catalogVersionId: string }>('/api/admin/catalog/import/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
