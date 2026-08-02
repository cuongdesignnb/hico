const isString = (value) => typeof value === 'string' && value.trim() !== '';
const isPrice = (value) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const validateItems = (items, type, errors) => {
  const productIds = new Set();
  const variantIds = new Set();

  for (const item of items) {
    if (!isString(item.id)) errors.push(`${type} has an invalid id.`);
    if (productIds.has(item.id)) errors.push(`Duplicate ${type} id: ${item.id}.`);
    productIds.add(item.id);
    if (!isString(item.sku)) errors.push(`${type} ${item.id} has an invalid sku.`);
    if (!isString(item.name)) errors.push(`${type} ${item.id} has an invalid name.`);
    if (!isPrice(item.price)) errors.push(`${type} ${item.id} has an invalid price.`);
    if (!Array.isArray(item.variants)) {
      errors.push(`${type} ${item.id} has invalid variants.`);
      continue;
    }
    for (const variant of item.variants) {
      if (!isString(variant.id)) {
        errors.push(`${type} ${item.id} has a variant with invalid id.`);
      }
      if (variantIds.has(variant.id)) {
        errors.push(`Duplicate legacy variant id: ${variant.id}.`);
      }
      variantIds.add(variant.id);
      if (!isString(variant.sku)) {
        errors.push(`Variant ${variant.id} has an invalid sku.`);
      }
      if (!isPrice(variant.price)) {
        errors.push(`Variant ${variant.id} has an invalid price.`);
      }
      if (!isString(variant.simType)) {
        errors.push(`Variant ${variant.id} has an invalid simType.`);
      }
    }
  }
};

export const validateLegacyProjection = ({
  destinations,
  packages,
  diagnostics,
}) => {
  const errors = [];
  if (!Array.isArray(destinations)) errors.push('Destinations must be an array.');
  if (!Array.isArray(packages)) errors.push('Packages must be an array.');
  if (errors.length === 0) {
    validateItems(destinations, 'destination', errors);
    validateItems(packages, 'package', errors);
  }
  if (diagnostics.classificationConflicts.length > 0) {
    errors.push('Canonical products contain legacy classification conflicts.');
  }
  if (diagnostics.unsupportedLegacyProjection.length > 0) {
    errors.push('Canonical products contain unsupported legacy projections.');
  }
  return { valid: errors.length === 0, errors };
};
