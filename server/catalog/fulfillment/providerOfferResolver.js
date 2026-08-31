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
  ok: code === PROVIDER_RESOLUTION_CODES.EXACT
    || code === PROVIDER_RESOLUTION_CODES.MAPPED_FALLBACK
    || code === PROVIDER_RESOLUTION_CODES.NEXT_LONGER,
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
  if (!variantMedium) {
    return result({
      code: fulfillmentProfile ? PROVIDER_RESOLUTION_CODES.PROFILE_INCOMPLETE : PROVIDER_RESOLUTION_CODES.MEDIUM_MISMATCH,
      requestedDays,
      reason: 'Catalog variant is missing an explicit fulfillment medium.',
    });
  }
  if (!variantFamilyKey) {
    return result({
      code: fulfillmentProfile ? PROVIDER_RESOLUTION_CODES.PROFILE_INCOMPLETE : PROVIDER_RESOLUTION_CODES.FAMILY_MISMATCH,
      requestedDays,
      reason: 'Catalog variant is missing an explicit provider offer family.',
    });
  }

  const activeWorldmoveOffers = offers.filter((offer) => (
    offer?.active === true
    && providerForOffer(offer) === 'WORLDMOVE'
    && durationDaysForOffer(offer)
  ));
  const mediumOffers = activeWorldmoveOffers.filter((offer) => mediumForSource(offer) === variantMedium);
  if (mediumOffers.length === 0) {
    return result({
      code: PROVIDER_RESOLUTION_CODES.MEDIUM_MISMATCH,
      requestedDays,
      reason: 'No active Worldmove offer has the requested medium.',
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

  if (activeBinding) {
    const mapped = compatibleOffers.find((offer) => offer.id === activeBinding.providerOfferId);
    const mappedDays = mapped ? durationDaysForOffer(mapped) : null;
    if (!mapped || activeBinding.strategy !== 'MAPPED_FALLBACK' || mappedDays < requestedDays) {
      return result({
        code: PROVIDER_RESOLUTION_CODES.MAPPING_INVALID,
        requestedDays,
        binding: activeBinding,
        reason: 'The approved provider mapping no longer points to a compatible active offer.',
      });
    }
    return result({
      code: PROVIDER_RESOLUTION_CODES.MAPPED_FALLBACK,
      strategy: 'MAPPED_FALLBACK',
      requestedDays,
      offer: mapped,
      binding: activeBinding,
      reason: 'An approved active mapping selects a compatible longer provider offer.',
    });
  }

  const longer = compatibleOffers
    .filter((offer) => durationDaysForOffer(offer) > requestedDays)
    .sort((left, right) => durationDaysForOffer(left) - durationDaysForOffer(right));
  if (longer.length > 0) {
    const shortestDays = durationDaysForOffer(longer[0]);
    const shortest = longer.filter((offer) => durationDaysForOffer(offer) === shortestDays);
    if (shortest.length > 1) {
      return result({
        code: PROVIDER_RESOLUTION_CODES.AMBIGUOUS,
        requestedDays,
        reason: 'Multiple compatible provider offers share the shortest longer duration.',
      });
    }
    return result({
      code: PROVIDER_RESOLUTION_CODES.NEXT_LONGER,
      strategy: 'NEXT_LONGER',
      requestedDays,
      offer: shortest[0],
      reason: 'The shortest compatible provider duration longer than requested was selected.',
    });
  }

  return result({
    code: compatibleOffers.length ? PROVIDER_RESOLUTION_CODES.TOO_SHORT : PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE,
    requestedDays,
    reason: compatibleOffers.length
      ? 'Compatible provider offers exist only at durations shorter than requested.'
      : 'No compatible provider offer is available.',
  });
};
