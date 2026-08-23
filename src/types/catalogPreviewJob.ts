import type { CatalogSheetSyncBatch } from './catalogSheetSync';

export type CatalogPreviewJobMode = 'legacy' | 'quick' | 'full';
export type CatalogPreviewJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
export type CatalogPreviewJobStage = 'STARTING' | 'READING_SHEET' | 'LOADING_CATALOG' | 'LOADING_PROVIDER' | 'PARSING' | 'BUILDING_CANDIDATE' | 'VALIDATING' | 'PERSISTING' | 'COMPLETED';
export type CatalogPreviewJobForMode<Mode extends CatalogPreviewJobMode> = CatalogPreviewJob & { mode: Mode };

export const CATALOG_PREVIEW_MODE_LABELS: Record<CatalogPreviewJobMode, string> = {
  legacy: 'Đọc Sheet cũ',
  quick: 'Đồng bộ nhanh HICO GỐC',
  full: 'Đồng bộ lại toàn bộ HICO GỐC',
};

export const isFullCatalogPreviewJob = (
  job: CatalogPreviewJob | null | undefined,
): job is CatalogPreviewJobForMode<'full'> => job?.mode === 'full';

export const isSheetCatalogPreviewJob = (
  job: CatalogPreviewJob | null | undefined,
): job is CatalogPreviewJobForMode<'legacy'> | CatalogPreviewJobForMode<'quick'> => job?.mode === 'legacy' || job?.mode === 'quick';

export const CATALOG_PREVIEW_STAGE_LABELS: Record<CatalogPreviewJobStage, string> = {
  STARTING: 'Đang khởi tạo',
  READING_SHEET: 'Đang đọc Google Sheet',
  LOADING_CATALOG: 'Đang tải Catalog hiện tại',
  LOADING_PROVIDER: 'Đang tải dữ liệu nhà cung cấp',
  PARSING: 'Đang phân tích dữ liệu Sheet',
  BUILDING_CANDIDATE: 'Đang dựng Catalog Candidate',
  VALIDATING: 'Đang kiểm tra Candidate',
  PERSISTING: 'Đang lưu Preview',
  COMPLETED: 'Hoàn tất',
};

export const CATALOG_PREVIEW_STAGE_ORDER: CatalogPreviewJobStage[] = [
  'READING_SHEET', 'PARSING', 'BUILDING_CANDIDATE', 'VALIDATING', 'PERSISTING', 'COMPLETED',
];

export const formatCatalogPreviewElapsed = (startedAt: string | null, now = Date.now()) => {
  if (!startedAt) return '00:00';
  const elapsed = Math.max(0, now - Date.parse(startedAt));
  const totalSeconds = Math.floor(elapsed / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

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
