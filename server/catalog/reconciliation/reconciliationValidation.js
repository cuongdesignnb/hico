export const RECONCILIATION_STATUSES = [
  'MATCHED',
  'NOT_FOUND',
  'DUPLICATE_PROVIDER_OFFER',
  'TYPE_CONFLICT',
  'LEGACY_CONFLICT',
  'MISSING_WMPRODUCT_ID',
  'INACTIVE_PROVIDER_OFFER',
  'NEEDS_REVIEW',
  'CONFIRMED_BY_ADMIN',
  'IGNORED_BY_ADMIN',
];

export const RECONCILIATION_RESOLUTIONS = [
  'WORLDMOVE_ESIM_REDEEM',
  'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  'WORLDMOVE_PHYSICAL_ORDER',
  'WORLDMOVE_TOPUP',
  'HICO_MANUAL_QR',
  'HICO_PHYSICAL_STOCK',
  'MANUAL_PROCESSING',
];

const STATUS_SET = new Set(RECONCILIATION_STATUSES);
const RESOLUTION_SET = new Set(RECONCILIATION_RESOLUTIONS);
const ALLOWED_FIELDS = new Set([
  'productId',
  'variantId',
  'sku',
  'wmproductId',
  'providerOfferId',
  'status',
  'suggestedResolution',
  'confirmedResolution',
  'reason',
  'reviewedBy',
  'reviewedAt',
  'providerSnapshotHash',
  'createdAt',
  'updatedAt',
]);

export class ReconciliationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReconciliationValidationError';
  }
}

const requireString = (value, fieldName) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ReconciliationValidationError(
      `Reconciliation record is missing ${fieldName}`,
    );
  }
};

const validateOptionalString = (value, fieldName) => {
  if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
    throw new ReconciliationValidationError(
      `Reconciliation record has invalid ${fieldName}`,
    );
  }
};

const validateDate = (value, fieldName) => {
  requireString(value, fieldName);
  if (Number.isNaN(Date.parse(value))) {
    throw new ReconciliationValidationError(
      `Reconciliation record has invalid ${fieldName}`,
    );
  }
};

export const isReconciliationResolution = (value) => RESOLUTION_SET.has(value);

export const validateReconciliationRecord = (record) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new ReconciliationValidationError(
      'Reconciliation record must be an object',
    );
  }

  for (const fieldName of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(fieldName)) {
      throw new ReconciliationValidationError(
        `Reconciliation record has unsupported field ${fieldName}`,
      );
    }
  }

  requireString(record.productId, 'productId');
  requireString(record.variantId, 'variantId');
  requireString(record.sku, 'sku');
  requireString(record.reason, 'reason');
  validateOptionalString(record.wmproductId, 'wmproductId');
  validateOptionalString(record.providerOfferId, 'providerOfferId');
  validateOptionalString(record.reviewedBy, 'reviewedBy');
  validateOptionalString(record.providerSnapshotHash, 'providerSnapshotHash');

  if (!STATUS_SET.has(record.status)) {
    throw new ReconciliationValidationError(
      'Reconciliation record has invalid status',
    );
  }

  if (
    record.suggestedResolution !== undefined
    && !RESOLUTION_SET.has(record.suggestedResolution)
  ) {
    throw new ReconciliationValidationError(
      'Reconciliation record has invalid suggestedResolution',
    );
  }

  if (
    record.confirmedResolution !== undefined
    && !RESOLUTION_SET.has(record.confirmedResolution)
  ) {
    throw new ReconciliationValidationError(
      'Reconciliation record has invalid confirmedResolution',
    );
  }

  validateDate(record.createdAt, 'createdAt');
  validateDate(record.updatedAt, 'updatedAt');

  if (record.reviewedAt !== undefined) {
    validateDate(record.reviewedAt, 'reviewedAt');
  }

  if (record.status === 'CONFIRMED_BY_ADMIN') {
    if (!record.confirmedResolution || !record.reviewedBy || !record.reviewedAt) {
      throw new ReconciliationValidationError(
        'Admin-confirmed record is missing review information',
      );
    }
  }

  if (
    record.status === 'IGNORED_BY_ADMIN'
    && (!record.reviewedBy || !record.reviewedAt)
  ) {
    throw new ReconciliationValidationError(
      'Admin-ignored record is missing review information',
    );
  }

  return record;
};

export const validateReconciliationRecords = (records) => {
  if (!Array.isArray(records)) {
    throw new ReconciliationValidationError(
      'Reconciliation records must be an array',
    );
  }

  const variantIds = new Set();

  for (const record of records) {
    validateReconciliationRecord(record);
    if (variantIds.has(record.variantId)) {
      throw new ReconciliationValidationError(
        `Duplicate reconciliation variantId: ${record.variantId}`,
      );
    }
    variantIds.add(record.variantId);
  }

  return records;
};
