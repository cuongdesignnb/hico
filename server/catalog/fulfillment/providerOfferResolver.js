import { createHash } from 'node:crypto';
import { resolutionForProviderOffer } from '../reconciliation/reconciliationRules.js';
import {
  durationDaysForOffer,
  durationDaysForVariant,
  familyKeyFor,
  isCompatibleFamily,
  mediumForSource,
  providerForOffer,
} from './providerOfferFamily.js';
import { isWorldmoveEsimOffer } from './fulfillmentContracts.js';

export const PROVIDER_RESOLUTION_CODES = Object.freeze({
  EXACT: 'PROVIDER_EXACT_MATCH',
  MAPPED_FALLBACK: 'PROVIDER_MAPPED_FALLBACK',
  NEXT_LONGER: 'PROVIDER_NEXT_LONGER',
  NOT_AVAILABLE: 'PROVIDER_OFFER_NOT_AVAILABLE',
  AMBIGUOUS: 'PROVIDER_AMBIGUOUS',
  FAMILY_MISMATCH: 'PROVIDER_FAMILY_MISMATCH',
  MEDIUM_MISMATCH: 'PROVIDER_MEDIUM_MISMATCH',
  TOO_SHORT: 'PROVIDER_DURATION_TOO_SHORT',
  MAPPING_INVALID: 'PROVIDER_MAPPING_INVALID',
  PROFILE_NOT_FOUND: 'FAMILY_PROFILE_NOT_FOUND',
  PROFILE_INCOMPLETE: 'FAMILY_METADATA_INCOMPLETE',
  PROFILE_CONFLICT: 'FAMILY_PROFILE_CONFLICT',
});

const stableJson = (value) => JSON.stringify(value, Object.keys(value).sort());
const normalizeWmid = (value) => String(value ?? '').trim().toUpperCase();

export const providerSnapshotHashFor = (offer) => createHash('sha256')
  .update(stableJson({
    id: offer?.id ?? null,
    provider: offer?.provider ?? null,
    wmproductId: offer?.wmproductId ?? null,
    providerProductId: offer?.providerProductId ?? null,
    providerProductName: offer?.providerProductName ?? null,
    productRegion: offer?.productRegion ?? null,
    providerProductType: offer?.providerProductType ?? null,
    leSIM: offer?.leSIM ?? null,
    medium: mediumForSource(offer),
    durationDays: durationDaysForOffer(offer),
    familyKey: familyKeyFor(offer),
    dataPolicy: offer?.dataPolicy ?? offer?.dataAllowance ?? offer?.dataLimit ?? null,
    speedPolicy: offer?.speedPolicy ?? offer?.speed ?? offer?.throttlePolicy ?? null,
    networkPolicy: offer?.networkPolicy ?? offer?.networkCoverage ?? offer?.networkLabel ?? null,
    activationPolicy: offer?.activationPolicy ?? offer?.activation ?? null,
    resetPolicy: offer?.resetPolicy ?? offer?.reset ?? null,
    operation: offer?.operation ?? offer?.operationType ?? null,
    active: offer?.active ?? null,
  }))
  .digest('hex');

const result = ({ code, strategy = null, requestedDays, offer = null, binding = null, reason }) => ({
  ok: code === PROVIDER_RESOLUTION_CODES.EXACT,
  code,
  strategy,
  requestedDays,
  provider: offer ? providerForOffer(offer) : null,
  providerOfferId: offer?.id ?? null,
  providerWmproductId: offer?.wmproductId ?? null,
  providerDurationDays: offer ? durationDaysForOffer(offer) : null,
  upgradeDays: offer ? durationDaysForOffer(offer) - requestedDays : null,
  bindingVersion: binding?.version ?? null,
  providerSnapshotHash: offer ? providerSnapshotHashFor(offer) : null,
  fulfillmentMethod: offer ? resolutionForProviderOffer(offer) : null,
  familyKey: offer ? familyKeyFor(offer) : null,
  reason,
});

export const resolveProviderOffer = ({
  variant,
  offers = [],
  activeBinding = null,
  fulfillmentProfile = null,
  requireFulfillmentProfile = false,
} = {}) => {
  const requestedDays = durationDaysForVariant(variant);
  if (!requestedDays) {
    return result({
      code: PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE,
      requestedDays: null,
      reason: 'Catalog variant is missing an explicit requested duration.',
    });
  }

  if (fulfillmentProfile && fulfillmentProfile.status && fulfillmentProfile.status !== 'ACTIVE') {
    return result({
      code: PROVIDER_RESOLUTION_CODES.PROFILE_NOT_FOUND,
      requestedDays,
      reason: 'Catalog variant has no active fulfillment profile.',
    });
  }
  if (requireFulfillmentProfile && !fulfillmentProfile) {
    return result({
      code: PROVIDER_RESOLUTION_CODES.PROFILE_NOT_FOUND,
      requestedDays,
      reason: 'Catalog variant has no active fulfillment profile.',
    });
  }
  if (fulfillmentProfile && fulfillmentProfile.variantId && fulfillmentProfile.variantId !== variant.id) {
    return result({
      code: PROVIDER_RESOLUTION_CODES.PROFILE_CONFLICT,
      requestedDays,
      reason: 'Fulfillment profile does not belong to the requested catalog variant.',
    });
  }
  const familySource = fulfillmentProfile ?? variant;
  const variantMedium = mediumForSource(familySource);
  const variantFamilyKey = familyKeyFor(familySource);
  const variantWmid = normalizeWmid(variant.wmproductId);
  if (!variantMedium) {
    return result({
      code: fulfillmentProfile ? PROVIDER_RESOLUTION_CODES.PROFILE_INCOMPLETE : PROVIDER_RESOLUTION_CODES.MEDIUM_MISMATCH,
      requestedDays,
      reason: 'Catalog variant is missing an explicit fulfillment medium.',
    });
  }
  if (!variantFamilyKey && !variantWmid) {
    return result({
      code: fulfillmentProfile ? PROVIDER_RESOLUTION_CODES.PROFILE_INCOMPLETE : PROVIDER_RESOLUTION_CODES.FAMILY_MISMATCH,
      requestedDays,
      reason: 'Catalog variant is missing an explicit provider offer family.',
    });
  }

  const activeWorldmoveOffers = offers.filter((offer) => isWorldmoveEsimOffer(offer) && durationDaysForOffer(offer));
  const mediumOffers = activeWorldmoveOffers.filter((offer) => mediumForSource(offer) === variantMedium);
  if (mediumOffers.length === 0) {
    return result({
      code: PROVIDER_RESOLUTION_CODES.MEDIUM_MISMATCH,
      requestedDays,
      reason: 'No active Worldmove offer has the requested medium.',
    });
  }

  // A canonical Worldmove WMID is an identity constraint. It may not be
  // replaced by a family match, an approved longer mapping, or a nearby day.
  if (variantWmid) {
    if (!variant.providerOfferId) {
      return result({
        code: activeBinding ? PROVIDER_RESOLUTION_CODES.MAPPING_INVALID : PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE,
        requestedDays,
        binding: activeBinding,
        reason: 'Canonical Worldmove identity is missing the exact providerOfferId.',
      });
    }
    const expectedLeSIM = typeof variant.leSIM === 'boolean'
      ? variant.leSIM
      : variant.fulfillmentMethod === 'WORLDMOVE_ESIM_REDEEM'
        ? true
        : variant.fulfillmentMethod === 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM'
          ? false
          : null;
    const identityMatches = mediumOffers.filter((offer) => (
      normalizeWmid(offer.wmproductId) === variantWmid
      && offer.id === variant.providerOfferId
      && (expectedLeSIM === null || offer.leSIM === expectedLeSIM)
    ));
    if (identityMatches.length > 1) {
      return result({
        code: PROVIDER_RESOLUTION_CODES.AMBIGUOUS,
        requestedDays,
        reason: 'Multiple active provider offers match the exact Worldmove WMID.',
      });
    }
    if (identityMatches.length === 1 && durationDaysForOffer(identityMatches[0]) === requestedDays) {
      return result({
        code: PROVIDER_RESOLUTION_CODES.EXACT,
        strategy: 'EXACT',
        requestedDays,
        offer: identityMatches[0],
        reason: 'One active provider offer exactly matches WMID and duration.',
      });
    }
    return result({
      code: activeBinding ? PROVIDER_RESOLUTION_CODES.MAPPING_INVALID : PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE,
      requestedDays,
      binding: activeBinding,
      reason: activeBinding
        ? 'Historical provider mapping cannot replace an exact WMID and duration match.'
        : 'No active provider offer exactly matches the canonical WMID and duration.',
    });
  }

  const compatibleOffers = mediumOffers.filter((offer) => isCompatibleFamily({ variant: familySource, offer }));
  if (compatibleOffers.length === 0) {
    return result({
      code: PROVIDER_RESOLUTION_CODES.FAMILY_MISMATCH,
      requestedDays,
      reason: 'No active Worldmove offer matches the explicit compatibility family.',
    });
  }

  const exact = compatibleOffers.filter((offer) => durationDaysForOffer(offer) === requestedDays);
  if (exact.length > 1) {
    return result({
      code: PROVIDER_RESOLUTION_CODES.AMBIGUOUS,
      requestedDays,
      reason: 'Multiple active provider offers match the exact family and duration.',
    });
  }
  if (exact.length === 1) {
    return result({
      code: PROVIDER_RESOLUTION_CODES.EXACT,
      strategy: 'EXACT',
      requestedDays,
      offer: exact[0],
      reason: 'One active provider offer exactly matches family, medium, and duration.',
    });
  }

  return result({
    code: activeBinding ? PROVIDER_RESOLUTION_CODES.MAPPING_INVALID : PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE,
    requestedDays,
    binding: activeBinding,
    reason: activeBinding
      ? 'Historical provider mapping cannot replace an exact provider duration match.'
      : 'No compatible provider offer exactly matches the requested duration.',
  });
};
