export type CatalogImportSourceMode = 'worldmove' | 'hico_manual_qr' | 'hico_physical' | 'manual_processing';

export interface CatalogImportColumnMap {
  family: string;
  productName?: string;
  sku: string;
  dataLimit: string;
  duration: string;
  price: string;
  compareAtPrice?: string;
  coverageType?: string;
  coverageId?: string;
}

export interface CatalogImportPreview {
  previewId: string;
  catalogVersionId: string;
  providerSnapshotHash: string;
  category: { id: string; name: string; kind: string };
  headers: string[];
  familyCount: number;
  rowCount: number;
  eligible: number;
  blocked: number;
  families: Array<{ family: string; productName: string; variants: number; coverageType: string; coverageIds: string[] }>;
  errors: Array<{ rowNumber: number; sku: string; errors: string[] }>;
  expiresAt: string;
}
