export const SHEET_SYNC_FIELDS = ['price', 'wmproductId', 'apn', 'networkLabel', 'publicNote'];
export const QUICK_SHEET_SYNC_FIELDS = [
  'productName',
  'dataPolicy',
  'dataLimit',
  'duration',
  'tripDayOptions',
  'price',
  'compareAtPrice',
  'wmproductId',
  'apn',
  'networkLabel',
  'publicNote',
  'activationPolicy',
  'speedLabel',
  'cancellable',
];
export const FULL_SHEET_SYNC_FIELDS = [...QUICK_SHEET_SYNC_FIELDS, 'imageUrl', 'galleryImageUrls', 'description', 'installationGuide'];
export const SHEET_SYNC_STATUSES = new Set(['FETCHED', 'VALIDATED', 'READY_FOR_REVIEW', 'APPLYING', 'APPLIED', 'PARTIALLY_APPLIED', 'REJECTED', 'FAILED']);
export const ROW_STATUSES = new Set(['VALID', 'INVALID', 'APPLIED', 'SKIPPED']);
export const CLEAR_VALUE = '__CLEAR__';

export class SheetSyncError extends Error {
  constructor(message, { code = 'SHEET_SYNC_FAILED', status = 400, details } = {}) {
    super(message);
    this.name = 'SheetSyncError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const publicBatch = (batch) => ({
  id: batch.id,
  status: batch.status,
  spreadsheetId: batch.spreadsheetId,
  sheetTab: batch.sheetTab,
  sheetRange: batch.sheetRange,
  sourceHash: batch.sourceHash,
  catalogVersionId: batch.catalogVersionId ?? null,
  mode: batch.mode ?? 'legacy',
  fieldMapping: batch.fieldMapping ?? null,
  priceMapping: batch.priceMapping ?? null,
  headerHash: batch.headerHash ?? null,
  providerSnapshotHash: batch.providerSnapshotHash ?? null,
  summary: batch.summary ?? {},
  createdAt: batch.createdAt,
  validatedAt: batch.validatedAt ?? null,
  appliedAt: batch.appliedAt ?? null,
  rejectedAt: batch.rejectedAt ?? null,
  approvedBy: batch.approvedBy ?? null,
});

export const publicRow = (row) => ({
  id: row.id,
  sheetRowNumber: row.sheetRowNumber,
  sourceRow: row.sourceRow ?? row.normalizedData?.sourceRow ?? row.sheetRowNumber,
  ...(Array.isArray(row.sourceRows) ? { sourceRows: row.sourceRows } : {}),
  sourceMedium: row.sourceMedium ?? row.normalizedData?.sourceMedium ?? null,
  variantId: row.variantId ?? null,
  status: row.status,
  normalizedData: publicNormalizedData(row.normalizedData ?? {}),
  diff: row.diff ?? {},
  errors: row.errors ?? [],
  warnings: row.warnings ?? [],
  appliedFields: row.appliedFields ?? [],
  appliedAt: row.appliedAt ?? null,
});

const PUBLIC_NORMALIZED_FIELDS = new Set([
  'productName', 'dataPolicy', 'dataLimit', 'duration', 'durationDays',
  'tripDayOptions', 'price', 'compareAtPrice', 'apn', 'networkLabel',
  'publicNote', 'activationPolicy', 'speedLabel', 'cancellable', 'medium',
  'sourceRows', 'imageUrl', 'galleryImageUrls', 'description', 'installationGuide',
]);

const publicNormalizedData = (value) => Object.fromEntries(
  Object.entries(value).filter(([key]) => PUBLIC_NORMALIZED_FIELDS.has(key)),
);
