const REVIEW_STATUSES = new Set([
  'NOT_FOUND',
  'DUPLICATE_PROVIDER_OFFER',
  'TYPE_CONFLICT',
  'LEGACY_CONFLICT',
  'MISSING_WMPRODUCT_ID',
  'INACTIVE_PROVIDER_OFFER',
  'NEEDS_REVIEW',
]);

export const summarizeReconciliation = (records) => {
  const count = (status) => records.filter(
    (record) => record.status === status,
  ).length;

  const duplicateProviderOffer = count('DUPLICATE_PROVIDER_OFFER');
  const typeConflict = count('TYPE_CONFLICT');
  const legacyConflict = count('LEGACY_CONFLICT');

  return {
    total: records.length,
    matched: count('MATCHED'),
    needsReview: records.filter(
      (record) => REVIEW_STATUSES.has(record.status),
    ).length,
    notFound: count('NOT_FOUND'),
    missingWmproductId: count('MISSING_WMPRODUCT_ID'),
    duplicateProviderOffer,
    typeConflict,
    legacyConflict,
    conflicts: duplicateProviderOffer + typeConflict + legacyConflict,
    inactiveProviderOffer: count('INACTIVE_PROVIDER_OFFER'),
    confirmedByAdmin: count('CONFIRMED_BY_ADMIN'),
    ignoredByAdmin: count('IGNORED_BY_ADMIN'),
  };
};
