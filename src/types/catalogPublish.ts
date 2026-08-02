export interface CatalogPublishResponse {
  previewId: string;
  catalogVersionId: string;
  affectedCount: number;
  changes: Array<{ id: string; changedFields: string[] }>;
  warnings?: Array<{ code?: string; message: string }>;
}
