import {
  FAMILY_REQUIRED_FIELDS,
  familyDescriptorFor,
  familyKeyFor,
  familyMetadataStatus,
  durationDaysForVariant,
} from './providerOfferFamily.js';

const profileError = (message, code = 'FAMILY_METADATA_INCOMPLETE', status = 422) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

export const normalizeProfileInput = (input = {}) => {
  const descriptor = familyDescriptorFor({
    providerEligibility: input.provider ?? input.providerEligibility,
    regionCode: input.regionCode ?? input.region,
    medium: input.medium,
    dataPolicy: input.dataPolicy,
    speedPolicy: input.speedPolicy,
    networkPolicy: input.networkPolicy,
    activationPolicy: input.activationPolicy,
    resetPolicy: input.resetPolicy,
    operationType: input.operationType,
  });
  const missing = FAMILY_REQUIRED_FIELDS.filter((field) => !descriptor[field]);
  if (missing.length) {
    throw profileError('Fulfillment profile is missing required family metadata.');
  }
  const familyKey = familyKeyFor(descriptor);
  if (!familyKey) throw profileError('Fulfillment profile family key could not be computed.');
  const durationDays = Number(input.durationDays);
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw profileError('Fulfillment profile has invalid duration.', 'FAMILY_PROFILE_INVALID');
  }
  return {
    provider: descriptor.provider,
    regionCode: descriptor.region,
    medium: descriptor.medium,
    dataPolicy: descriptor.dataPolicy,
    speedPolicy: descriptor.speedPolicy,
    networkPolicy: descriptor.networkPolicy,
    activationPolicy: descriptor.activationPolicy,
    resetPolicy: descriptor.resetPolicy,
    operationType: descriptor.operationType,
    durationDays,
    familyKey,
    source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'ADMIN_APPROVED',
  };
};

export const validateProfileForVariant = ({ input, variant }) => {
  if (!variant?.id) throw profileError('Catalog variant was not found.', 'CATALOG_VARIANT_NOT_FOUND', 404);
  const normalized = normalizeProfileInput(input);
  const variantDuration = durationDaysForVariant(variant);
  if (!variantDuration || normalized.durationDays !== variantDuration) {
    throw profileError('Fulfillment profile duration does not match the catalog variant.', 'FAMILY_PROFILE_DURATION_MISMATCH');
  }
  const variantStatus = familyMetadataStatus(normalized);
  if (!variantStatus.complete) throw profileError('Fulfillment profile is incomplete.');
  return {
    variantId: variant.id,
    ...normalized,
  };
};

export const profileValidationError = profileError;
