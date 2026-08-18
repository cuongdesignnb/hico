export interface CatalogResetPreview {
  currentVersionId: string | null;
  products: number;
  variants: number;
  linkedMedia: number;
  mediaReferences: number;
  after: { products: number; variants: number };
  preserved: { categories: number; providerOffers: number; manualQrs: number; mediaDeleted: number; orders: boolean; customers: boolean; catalogVersions: boolean };
  confirmation: string;
}

export interface CatalogResetResult {
  reset: boolean;
  previousVersionId: string | null;
  catalogVersionId: string;
  products: number;
  variants: number;
  mediaDeleted: number;
}

export interface CatalogMaintenanceStatus {
  enabled: boolean;
  globalProductionReady: boolean;
  resetAllowed: boolean;
  fullSyncAllowed: boolean;
  blockers: string[];
}

export interface CatalogFullSyncSummary {
  total?: number;
  valid?: number;
  invalid?: number;
  products?: number;
  variants?: number;
  invalidRows?: number;
  enrichmentSourceVersionId?: string | null;
  imagesReused?: number;
  imagesFromSheet?: number;
  imagesFallback?: number;
  descriptionsReused?: number;
  descriptionsFromSheet?: number;
  descriptionsFallback?: number;
  installationGuideReused?: number;
  installationGuideFromSheet?: number;
  installationGuideFallback?: number;
}
