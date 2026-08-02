export const createMigrationReport = ({
  migrationId,
  startedAt,
  completedAt,
  parity,
  reconciliationApplied,
  validation,
  checksums,
  sourceErrors = [],
}) => {
  const errors = [...sourceErrors, ...validation.errors];
  return {
    migrationId,
    startedAt,
    completedAt,
    ...parity,
    reconciliationApplied,
    publishSafety: validation.publishSafety,
    warnings: validation.warnings,
    errors,
    productsChecksum: checksums.productsChecksum,
    variantsChecksum: checksums.variantsChecksum,
    productsBusinessChecksum: checksums.productsBusinessChecksum,
    variantsBusinessChecksum: checksums.variantsBusinessChecksum,
    businessChecksum: checksums.businessChecksum,
    success: errors.length === 0,
  };
};
