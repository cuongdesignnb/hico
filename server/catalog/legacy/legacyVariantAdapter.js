const SIM_TYPE_BY_FULFILLMENT = {
  WORLDMOVE_ESIM_REDEEM: 'leSIM',
  WORLDMOVE_ESIM_ORDER_THEN_REDEEM: 'eSIM',
  HICO_MANUAL_QR: 'manual',
  HICO_PHYSICAL_STOCK: 'physical',
  WORLDMOVE_PHYSICAL_ORDER: 'physical',
};

const compact = (entries) => Object.fromEntries(
  entries.filter(([, value]) => value !== undefined),
);

export const adaptLegacyVariant = (variant) => {
  if (variant.fulfillmentMethod === 'WORLDMOVE_TOPUP') {
    return {
      variant: null,
      unsupported: {
        productId: variant.productId,
        variantId: variant.id,
        reason: 'WORLDMOVE_TOPUP is not supported by the legacy catalog schema.',
      },
    };
  }

  const hasProjection = variant.legacyProjection !== undefined;
  const projection = variant.legacyProjection ?? {};
  const simType = projection.simType
    ?? variant.legacySimType
    ?? SIM_TYPE_BY_FULFILLMENT[variant.fulfillmentMethod];
  const leSIM = hasProjection
    ? projection.leSIM
    : simType === 'leSIM'
      ? true
      : simType === 'eSIM'
        ? variant.leSIM ?? false
        : undefined;

  return {
    variant: compact([
      ['id', projection.id ?? variant.id],
      ['sku', projection.sku ?? variant.sku],
      ['dataLimit', projection.dataLimit ?? variant.dataLimit],
      ['duration', projection.duration ?? variant.duration],
      ['price', projection.price ?? variant.price],
      ['compareAtPrice', Object.hasOwn(projection, 'compareAtPrice')
        ? projection.compareAtPrice
        : variant.compareAtPrice],
      ['wmproductId', projection.wmproductId ?? variant.wmproductId],
      ['simType', simType],
      ['leSIM', leSIM],
      ['active', projection.active],
      ['currency', projection.currency],
    ]),
    unsupported: null,
  };
};
