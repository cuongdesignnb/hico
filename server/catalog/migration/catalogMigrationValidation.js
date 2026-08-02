const requiredArray = (value, name, errors) => {
  if (!Array.isArray(value)) errors.push(`${name} must be an array.`);
};

export const validateMigrationSources = ({
  destinations,
  packages,
  providerOffers,
  reconciliationRecords,
  manualQrs,
}) => {
  const errors = [];
  requiredArray(destinations, 'destinations', errors);
  requiredArray(packages, 'packages', errors);
  requiredArray(providerOffers, 'providerOffers', errors);
  requiredArray(reconciliationRecords, 'reconciliationRecords', errors);
  requiredArray(manualQrs, 'manualQrs', errors);
  return { valid: errors.length === 0, errors };
};
