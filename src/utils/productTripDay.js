const dimensionsMatch = (variant, selectedVariant, selectedDataLimit, selectedDataPolicy) => {
  const dataLimit = selectedDataLimit ?? selectedVariant?.dataLimit;
  const dataPolicy = selectedDataPolicy ?? selectedVariant?.dataPolicy;
  return (dataLimit === undefined || dataLimit === null || dataLimit === '' || variant.dataLimit === dataLimit)
    && (dataPolicy === undefined || dataPolicy === null || dataPolicy === '' || variant.dataPolicy === dataPolicy);
};

export const resolveVariantForTripDay = ({
  variants = [],
  day,
  selectedVariant = null,
  selectedDataLimit,
  selectedDataPolicy,
} = {}) => {
  if (!Number.isInteger(day) || day < 1) return null;
  return variants.find((variant) => (
    variant.medium === 'esim'
    && Array.isArray(variant.tripDayOptions)
    && variant.tripDayOptions.includes(day)
    && dimensionsMatch(variant, selectedVariant, selectedDataLimit, selectedDataPolicy)
  )) ?? null;
};
