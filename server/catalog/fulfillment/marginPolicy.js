export const MARGIN_STATUSES = Object.freeze({
  OK: 'MARGIN_OK',
  BELOW_POLICY: 'MARGIN_BELOW_POLICY',
  UNKNOWN_CURRENCY: 'MARGIN_UNKNOWN_CURRENCY',
});

export const evaluateMargin = ({
  soldPrice,
  soldCurrency,
  providerCost,
  providerCurrency,
  minMarginPercent = 0,
} = {}) => {
  if (
    typeof soldPrice !== 'number'
    || !Number.isFinite(soldPrice)
    || typeof providerCost !== 'number'
    || !Number.isFinite(providerCost)
    || typeof soldCurrency !== 'string'
    || typeof providerCurrency !== 'string'
    || soldCurrency !== providerCurrency
  ) {
    return { status: MARGIN_STATUSES.UNKNOWN_CURRENCY, marginAmount: null, marginPercent: null };
  }

  const marginAmount = soldPrice - providerCost;
  const marginPercent = soldPrice > 0 ? (marginAmount / soldPrice) * 100 : null;
  const policy = Number.isFinite(Number(minMarginPercent)) ? Number(minMarginPercent) : 0;
  if (marginPercent === null || marginPercent < policy) {
    return { status: MARGIN_STATUSES.BELOW_POLICY, marginAmount, marginPercent };
  }
  return { status: MARGIN_STATUSES.OK, marginAmount, marginPercent };
};
