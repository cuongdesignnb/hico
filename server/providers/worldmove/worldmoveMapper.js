import { createHash } from 'node:crypto';
import {
  ProviderOfferValidationError,
  validateProviderOffers,
} from '../providerOfferValidation.js';

const requireString = (value, fieldName) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ProviderOfferValidationError(
      `Worldmove quotation is missing ${fieldName}`,
    );
  }

  return value.trim();
};

const requireProductType = (value) => {
  if (![0, 1, 2].includes(value)) {
    throw new ProviderOfferValidationError(
      'Worldmove quotation has invalid productType',
    );
  }

  return value;
};

const requirePrice = (value, fieldName) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ProviderOfferValidationError(
      `Worldmove quotation has invalid ${fieldName}`,
    );
  }

  return value;
};

const createRawHash = (rawOffer) => {
  const normalized = {
    wmproductId: rawOffer.wmproductId,
    productId: rawOffer.productId,
    productName: rawOffer.productName,
    productNamelang: rawOffer.productNamelang ?? null,
    productRegion: rawOffer.productRegion,
    productType: rawOffer.productType,
    productPrice: rawOffer.productPrice,
    productcPrice: rawOffer.productcPrice,
    csight: rawOffer.csight,
    leSIM: rawOffer.leSIM,
  };

  return createHash('sha256')
    .update(JSON.stringify(normalized), 'utf8')
    .digest('hex');
};

export const mapWorldmoveOffer = (rawOffer, syncedAt) => {
  if (!rawOffer || typeof rawOffer !== 'object' || Array.isArray(rawOffer)) {
    throw new ProviderOfferValidationError(
      'Worldmove quotation item must be an object',
    );
  }

  const wmproductId = requireString(rawOffer.wmproductId, 'wmproductId');
  const providerProductType = requireProductType(rawOffer.productType);

  if (providerProductType === 0 && typeof rawOffer.leSIM !== 'boolean') {
    throw new ProviderOfferValidationError(
      'Worldmove eSIM quotation is missing leSIM',
    );
  }

  const offer = {
    id: `worldmove:${wmproductId}`,
    provider: 'worldmove',
    wmproductId,
    providerProductId: requireString(rawOffer.productId, 'productId'),
    providerProductName: requireString(rawOffer.productName, 'productName'),
    providerProductLanguage: rawOffer.productNamelang === null
      || rawOffer.productNamelang === undefined
      ? null
      : requireString(rawOffer.productNamelang, 'productNamelang'),
    productRegion: requireString(rawOffer.productRegion, 'productRegion'),
    providerProductType,
    leSIM: typeof rawOffer.leSIM === 'boolean' ? rawOffer.leSIM : null,
    providerCost: requirePrice(rawOffer.productPrice, 'productPrice'),
    providerCurrency: 'TWD',
    cEndPrice: requirePrice(rawOffer.productcPrice, 'productcPrice'),
    cEndVisible: rawOffer.csight === 1,
    active: true,
    syncedAt,
    rawHash: createRawHash(rawOffer),
  };

  return offer;
};

export const mapWorldmoveQuotation = (response, syncedAt) => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new ProviderOfferValidationError(
      'Worldmove quotation response must be an object',
    );
  }

  if (response.code !== 0) {
    throw new ProviderOfferValidationError(
      `Worldmove quotation failed with code ${String(response.code)}`,
    );
  }

  if (!Array.isArray(response.prodList)) {
    throw new ProviderOfferValidationError(
      'Worldmove quotation response is missing prodList',
    );
  }

  const offers = response.prodList.map(
    (rawOffer) => mapWorldmoveOffer(rawOffer, syncedAt),
  );

  return validateProviderOffers(offers);
};
