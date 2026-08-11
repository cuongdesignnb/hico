import { SheetSyncError } from './sheetSyncTypes.js';
import { resolveProviderOffer as resolveFulfillmentOffer } from '../fulfillment/providerOfferResolver.js';
import { mediumForSource } from '../fulfillment/providerOfferFamily.js';

const expectedMethod = (offer) => {
  if (offer.providerProductType === 0 && offer.leSIM === true) return 'WORLDMOVE_ESIM_REDEEM';
  if (offer.providerProductType === 0 && offer.leSIM === false) return 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM';
  if (offer.providerProductType === 1) return 'WORLDMOVE_PHYSICAL_ORDER';
  if (offer.providerProductType === 2) return 'WORLDMOVE_TOPUP';
  return null;
};

export const resolveProviderOffer = ({ wmproductId, variant, product, offers, fulfillmentProfile = null }) => {
  const matches = offers.filter((offer) => offer.wmproductId === wmproductId);
  if (matches.length === 0 && fulfillmentProfile) {
    const resolution = resolveFulfillmentOffer({
      variant,
      offers,
      fulfillmentProfile,
      requireFulfillmentProfile: true,
    });
    if (resolution.ok) {
      return {
        offer: offers.find((offer) => offer.id === resolution.providerOfferId) ?? null,
        resolution,
        fallback: true,
      };
    }
    return { error: { code: resolution.code, field: 'wmproductId' }, resolution };
  }
  if (matches.length === 0) return { error: { code: 'PROVIDER_NOT_FOUND', field: 'wmproductId' } };
  if (matches.length > 1) return { error: { code: 'PROVIDER_NOT_FOUND', field: 'wmproductId' } };
  const offer = matches[0];
  const expectedType = product.operation === 'topup' ? 2 : mediumForSource(fulfillmentProfile ?? variant) === 'PHYSICAL_SIM' ? 1 : 0;
  if (!offer.active || offer.provider !== 'worldmove') return { error: { code: 'PROVIDER_NOT_FOUND', field: 'wmproductId' } };
  if (offer.providerProductType !== expectedType) return { error: { code: 'PROVIDER_MEDIUM_MISMATCH', field: 'wmproductId' } };
  if (!fulfillmentProfile && expectedMethod(offer) !== variant.fulfillmentMethod) return { error: { code: 'PROVIDER_OPERATION_MISMATCH', field: 'wmproductId' } };
  if (fulfillmentProfile) {
    const resolution = resolveFulfillmentOffer({ variant, offers, fulfillmentProfile, requireFulfillmentProfile: true });
    if (!resolution.ok || resolution.providerOfferId !== offer.id) return { error: { code: resolution.code, field: 'wmproductId' }, resolution };
    return { offer, resolution };
  }
  return { offer, resolution: null };
};

export const validateSheetRow = ({ row, product, variant, offers, fulfillmentProfile = null }) => {
  const errors = [...row.errors];
  let offer = null;
  const wmproductId = row.normalizedData.wmproductId;
  if (wmproductId !== undefined) {
    const resolved = resolveProviderOffer({ wmproductId, variant, product, offers, fulfillmentProfile });
    if (resolved.error) errors.push(resolved.error);
    else offer = resolved.offer;
  }
  if (row.normalizedData.currency !== undefined && row.normalizedData.currency !== variant.currency) errors.push({ code: 'CURRENCY_MISMATCH', field: 'currency' });
  if (row.normalizedData.price !== undefined && variant.currency !== 'VND') errors.push({ code: 'CURRENCY_MISMATCH', field: 'price' });
  return { valid: errors.length === 0, errors, offer };
};

export const assertSelection = (value, allowed) => {
  if (value === undefined) return [...allowed];
  if (!Array.isArray(value) || value.some((item) => !allowed.includes(item))) {
    throw new SheetSyncError('Invalid Sheet Sync field selection.', { code: 'SHEET_SELECTION_INVALID' });
  }
  return value;
};
