import { createCanonicalCatalogReader } from '../canonical/canonicalCatalogReader.js';
import { createFulfillmentProfileRepository } from './fulfillmentProfileRepository.js';
import { durationDaysForVariant } from './providerOfferFamily.js';
import { validateProfileForVariant } from './fulfillmentProfileValidation.js';

const serviceError = (message, code, status = 422) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

export const createFulfillmentProfileService = ({
  catalogReader = createCanonicalCatalogReader(),
  profileRepository = createFulfillmentProfileRepository(),
  audit = async () => undefined,
  now = () => new Date().toISOString(),
} = {}) => {
  const load = async () => {
    const [catalog, profiles] = await Promise.all([catalogReader.readCatalog(), profileRepository.list()]);
    const profilesByVariant = new Map(profiles.filter((profile) => profile.status === 'ACTIVE').map((profile) => [profile.variantId, profile]));
    return { catalog, profiles, profilesByVariant };
  };

  const target = async (variantId) => {
    const { catalog, profilesByVariant } = await load();
    const variant = catalog.variants.find((item) => item.id === variantId);
    if (!variant) throw serviceError('Catalog variant was not found.', 'CATALOG_VARIANT_NOT_FOUND', 404);
    return { variant, activeProfile: profilesByVariant.get(variantId) ?? null };
  };

  return {
    async list() {
      const { profiles } = await load();
      return { items: profiles, total: profiles.length, generatedAt: now() };
    },

    async preview() {
      const { catalog, profilesByVariant } = await load();
      return {
        items: catalog.variants
          .filter((variant) => variant.active !== false && variant.archived !== true)
          .map((variant) => ({
            variantId: variant.id,
            sku: variant.sku ?? null,
            durationDays: durationDaysForVariant(variant),
            activeProfile: profilesByVariant.get(variant.id) ?? null,
            evidenceSource: profilesByVariant.get(variant.id)?.source ?? null,
          })),
        generatedAt: now(),
      };
    },

    async approve({ input, confirmed, actor = {} } = {}) {
      if (confirmed !== true) throw serviceError('Admin confirmation is required before persisting a fulfillment profile.', 'ADMIN_CONFIRMATION_REQUIRED', 400);
      const { variant, activeProfile } = await target(input?.variantId);
      const validated = validateProfileForVariant({ input, variant });
      const saved = activeProfile
        ? await profileRepository.update(activeProfile.id, validated, actor, input.version ?? activeProfile.version)
        : await profileRepository.create(validated, actor);
      await audit({ event: activeProfile ? 'catalog_fulfillment_profile_updated' : 'catalog_fulfillment_profile_created', actorId: actor.id ?? null, profileId: saved.id, variantId: saved.variantId, version: saved.version, at: now() });
      return saved;
    },

    async update(id, { input, confirmed, actor = {} } = {}) {
      if (confirmed !== true) throw serviceError('Admin confirmation is required before updating a fulfillment profile.', 'ADMIN_CONFIRMATION_REQUIRED', 400);
      const current = await profileRepository.getById(id);
      if (!current) throw serviceError('Fulfillment profile was not found.', 'FAMILY_PROFILE_NOT_FOUND', 404);
      const { variant } = await target(current.variantId);
      const validated = validateProfileForVariant({ input: { ...current, ...input, variantId: current.variantId, provider: current.provider }, variant });
      const saved = await profileRepository.update(id, validated, actor, input.version ?? current.version);
      await audit({ event: 'catalog_fulfillment_profile_updated', actorId: actor.id ?? null, profileId: saved.id, variantId: saved.variantId, version: saved.version, at: now() });
      return saved;
    },

    async revoke(id, { version, confirmed } = {}, actor = {}) {
      if (confirmed !== true) throw serviceError('Admin confirmation is required before revoking a fulfillment profile.', 'ADMIN_CONFIRMATION_REQUIRED', 400);
      const saved = await profileRepository.revoke(id, actor, version);
      await audit({ event: 'catalog_fulfillment_profile_revoked', actorId: actor.id ?? null, profileId: saved.id, variantId: saved.variantId, version: saved.version, at: now() });
      return saved;
    },
  };
};
