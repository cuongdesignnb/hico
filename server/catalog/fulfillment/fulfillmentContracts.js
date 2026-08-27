export const LEGACY_FULFILLMENT_METHODS = Object.freeze(new Set([
  'WORLDMOVE_TOPUP',
  'WORLDMOVE_PHYSICAL_ORDER',
]));

export const ACTIVE_SELLABLE_FULFILLMENT_METHODS = Object.freeze(new Set([
  'WORLDMOVE_ESIM_REDEEM',
  'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  'HICO_MANUAL_QR',
  'HICO_PHYSICAL_STOCK',
]));

export const ACTIVE_FULFILLMENT_METHODS = Object.freeze(new Set([
  ...ACTIVE_SELLABLE_FULFILLMENT_METHODS,
  'MANUAL_PROCESSING',
]));

export const WORLD_MOVE_ESIM_PRODUCT_TYPE = 0;

export const isLegacyFulfillmentMethod = (method) => LEGACY_FULFILLMENT_METHODS.has(method);

export const isActiveSellableFulfillmentMethod = (method) => ACTIVE_SELLABLE_FULFILLMENT_METHODS.has(method);

export const isWorldmoveEsimOffer = (offer) => (
  offer?.provider === 'worldmove'
  && offer?.providerProductType === WORLD_MOVE_ESIM_PRODUCT_TYPE
  && typeof offer?.leSIM === 'boolean'
);
