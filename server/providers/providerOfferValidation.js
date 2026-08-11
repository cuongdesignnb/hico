const PROVIDER_PRODUCT_TYPES = new Set([0, 1, 2]);

export class ProviderOfferValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderOfferValidationError';
  }
}

const requireString = (value, fieldName) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ProviderOfferValidationError(`Provider offer is missing ${fieldName}`);
  }

  return value;
};

const requireFiniteNumber = (value, fieldName) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ProviderOfferValidationError(`Provider offer has invalid ${fieldName}`);
  }

  return value;
};

const optionalPublicText = (value, fieldName) => {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ProviderOfferValidationError(`Provider offer has invalid ${fieldName}`);
  }
};

export const validateProviderOffer = (offer) => {
  if (!offer || typeof offer !== 'object' || Array.isArray(offer)) {
    throw new ProviderOfferValidationError('Provider offer must be an object');
  }

  requireString(offer.id, 'id');

  if (offer.provider !== 'worldmove') {
    throw new ProviderOfferValidationError('Provider offer has invalid provider');
  }

  requireString(offer.wmproductId, 'wmproductId');
  requireString(offer.providerProductName, 'providerProductName');
  requireString(offer.productRegion, 'productRegion');

  if (!PROVIDER_PRODUCT_TYPES.has(offer.providerProductType)) {
    throw new ProviderOfferValidationError('Provider offer has invalid providerProductType');
  }

  if (
    offer.providerProductType === 0
    && typeof offer.leSIM !== 'boolean'
  ) {
    throw new ProviderOfferValidationError('Worldmove eSIM offer is missing leSIM');
  }

  requireFiniteNumber(offer.providerCost, 'providerCost');

  if (offer.providerCurrency !== 'TWD') {
    throw new ProviderOfferValidationError('Provider offer has invalid providerCurrency');
  }

  if (
    offer.cEndPrice !== null
    && offer.cEndPrice !== undefined
  ) {
    requireFiniteNumber(offer.cEndPrice, 'cEndPrice');
  }

  if (typeof offer.active !== 'boolean') {
    throw new ProviderOfferValidationError('Provider offer has invalid active state');
  }

  optionalPublicText(offer.apnHint, 'apnHint');
  optionalPublicText(offer.networkLabel, 'networkLabel');

  if (
    typeof offer.syncedAt !== 'string'
    || Number.isNaN(Date.parse(offer.syncedAt))
  ) {
    throw new ProviderOfferValidationError('Provider offer has invalid syncedAt');
  }

  return offer;
};

export const validateProviderOffers = (offers) => {
  if (!Array.isArray(offers)) {
    throw new ProviderOfferValidationError('Provider offers must be an array');
  }

  const ids = new Set();
  const wmproductIds = new Set();

  for (const offer of offers) {
    validateProviderOffer(offer);

    if (ids.has(offer.id)) {
      throw new ProviderOfferValidationError(`Duplicate provider offer id: ${offer.id}`);
    }
    if (wmproductIds.has(offer.wmproductId)) {
      throw new ProviderOfferValidationError(
        `Duplicate Worldmove product id: ${offer.wmproductId}`,
      );
    }

    ids.add(offer.id);
    wmproductIds.add(offer.wmproductId);
  }

  return offers;
};
