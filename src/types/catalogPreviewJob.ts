import type { CatalogSheetSyncBatch } from './catalogSheetSync';

export type CatalogPreviewJobMode = 'legacy' | 'quick' | 'full';
export type CatalogPreviewJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
export type CatalogPreviewJobStage = 'STARTING' | 'READING_SHEET' | 'LOADING_CATALOG' | 'LOADING_PROVIDER' | 'PARSING' | 'BUILDING_CANDIDATE' | 'VALIDATING' | 'PERSISTING' | 'COMPLETED';

export interface CatalogPreviewJob {
  id: string;
  mode: CatalogPreviewJobMode;
  status: CatalogPreviewJobStatus;
  stage: CatalogPreviewJobStage;
  actorId: string | null;
  batchId: string | null;
  batch: CatalogSheetSyncBatch | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  expiresAt: string | null;
}
