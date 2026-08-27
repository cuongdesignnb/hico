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
  && offer?.active === true
  && offer?.providerProductType === WORLD_MOVE_ESIM_PRODUCT_TYPE
  && typeof offer?.leSIM === 'boolean'
);

const normalizeWmid = (value) => String(value ?? '').normalize('NFC').trim().toUpperCase();

export const matchesExactSimHicoOffer = ({ variant, offer } = {}) => {
  const expectedLeSIM = variant?.fulfillmentMethod === 'WORLDMOVE_ESIM_REDEEM'
    ? true
    : variant?.fulfillmentMethod === 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM'
      ? false
      : null;
  if (
    variant?.source !== 'HICO_ESIM_SHEET'
    || !variant.providerOfferId
    || !variant.wmproductId
    || expectedLeSIM === null
  ) return false;
  return isWorldmoveEsimOffer(offer)
    && offer.id === variant.providerOfferId
    && normalizeWmid(offer.wmproductId) === normalizeWmid(variant.wmproductId)
    && offer.leSIM === expectedLeSIM;
};
