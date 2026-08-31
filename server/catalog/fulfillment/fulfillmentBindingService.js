import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createCanonicalCatalogReader } from '../canonical/canonicalCatalogReader.js';
import { createFulfillmentBindingRepository } from './fulfillmentBindingRepository.js';
import { createFulfillmentProfileRepository } from './fulfillmentProfileRepository.js';
import {
  durationDaysForOffer,
  durationDaysForVariant,
  familyKeyFor,
  isCompatibleFamily,
  mediumForSource,
  providerForOffer,
} from './providerOfferFamily.js';
import { PROVIDER_RESOLUTION_CODES, providerSnapshotHashFor, resolveProviderOffer } from './providerOfferResolver.js';
import { evaluateMargin } from './marginPolicy.js';

const serviceError = (message, code, status = 422) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const productForVariant = (catalog, variant) => catalog.products.find((product) => product.id === variant.productId) ?? null;

const offerSummary = (offer) => (offer ? {
  id: offer.id,
  wmproductId: offer.wmproductId,
  providerProductId: offer.providerProductId ?? null,
  providerProductName: offer.providerProductName ?? null,
  productRegion: offer.productRegion ?? null,
  providerProductType: offer.providerProductType ?? null,
  leSIM: offer.leSIM ?? null,
  medium: mediumForSource(offer),
  durationDays: durationDaysForOffer(offer),
  providerCost: offer.providerCost ?? null,
  providerCurrency: offer.providerCurrency ?? null,
  active: offer.active === true,
  snapshotHash: providerSnapshotHashFor(offer),
} : null);

const previewFor = ({ product, variant, offers, binding, profile }) => {
  const familySource = profile ?? variant;
  const resolution = resolveProviderOffer({ variant, offers, activeBinding: binding, fulfillmentProfile: profile, requireFulfillmentProfile: Boolean(profile || binding) });
  const candidateOffers = offers
    .filter((offer) => offer.active === true && providerForOffer(offer) === 'WORLDMOVE')
    .filter((offer) => mediumForSource(offer) === mediumForSource(familySource))
    .filter((offer) => isCompatibleFamily({ variant: familySource, offer }))
    .sort((left, right) => (durationDaysForOffer(left) ?? 0) - (durationDaysForOffer(right) ?? 0));
  return {
    async getBinding(id) {
      return bindingRepository.getById(id);
    },

    productId: product.id,
    productName: product.name ?? product.title ?? product.slug ?? product.id,
    variantId: variant.id,
    sku: variant.sku ?? null,
    requestedDays: durationDaysForVariant(variant),
    medium: mediumForSource(familySource),
    familyKey: familyKeyFor(familySource),
    fulfillmentProfile: profile ? {
      id: profile.id,
      status: profile.status,
      source: profile.source,
      version: profile.version,
    } : null,
    strategy: resolution.strategy,
    code: resolution.code,
    status: binding?.status ?? 'UNBOUND',
    warnings: resolution.ok ? [] : [resolution.code],
    providerDays: resolution.providerDurationDays,
    upgradeDays: resolution.upgradeDays,
    providerOffer: offerSummary(resolution.providerOfferId ? offers.find((offer) => offer.id === resolution.providerOfferId) : null),
    exactOffer: offerSummary(candidateOffers.find((offer) => durationDaysForOffer(offer) === durationDaysForVariant(variant))),
    nextLongerOffer: offerSummary(candidateOffers.find((offer) => durationDaysForOffer(offer) > durationDaysForVariant(variant))),
    fallbackOffers: candidateOffers.filter((offer) => durationDaysForOffer(offer) > durationDaysForVariant(variant)).map(offerSummary),
    margin: evaluateMargin({
      soldPrice: variant.price,
      soldCurrency: variant.currency,
      providerCost: resolution.providerOfferId ? offers.find((offer) => offer.id === resolution.providerOfferId)?.providerCost : null,
      providerCurrency: resolution.providerOfferId ? offers.find((offer) => offer.id === resolution.providerOfferId)?.providerCurrency : null,
    }),
    binding: binding ? {
      id: binding.id,
      providerOfferId: binding.providerOfferId,
      providerDays: binding.providerDays,
      upgradeDays: binding.upgradeDays,
      version: binding.version,
      status: binding.status,
      strategy: binding.strategy,
      snapshotHash: binding.providerSnapshotHash,
    } : null,
  };
};

export const createFulfillmentBindingService = ({
  catalogReader = createCanonicalCatalogReader(),
  providerRepository = createProviderOfferRepository(),
  bindingRepository = createFulfillmentBindingRepository(),
  profileRepository = createFulfillmentProfileRepository(),
  audit = async () => undefined,
  now = () => new Date().toISOString(),
} = {}) => {
  const load = async () => {
    const [catalog, offers, bindings, profiles] = await Promise.all([
      catalogReader.readCatalog(),
      providerRepository.listOffers(),
      bindingRepository.listActive('WORLDMOVE'),
      profileRepository.listActive('WORLDMOVE'),
    ]);
    const bindingByVariant = new Map(bindings.map((binding) => [binding.variantId, binding]));
    const profileByVariant = new Map(profiles.map((profile) => [profile.variantId, profile]));
    return { catalog, offers, bindingByVariant, profileByVariant };
  };

  const requireTarget = async (variantId) => {
    const { catalog, offers, bindingByVariant, profileByVariant } = await load();
    const variant = catalog.variants.find((item) => item.id === variantId);
    const product = variant ? productForVariant(catalog, variant) : null;
    if (!variant || !product) throw serviceError('Catalog variant was not found.', 'CATALOG_VARIANT_NOT_FOUND', 404);
    return { catalog, offers, binding: bindingByVariant.get(variantId) ?? null, profile: profileByVariant.get(variantId) ?? null, variant, product };
  };

  return {
    async listPreview({ limit = 500 } = {}) {
      const { catalog, offers, bindingByVariant, profileByVariant } = await load();
      const items = catalog.variants
        .filter((variant) => variant.active !== false && variant.archived !== true)
        .map((variant) => {
          const product = productForVariant(catalog, variant);
          return product ? previewFor({ product, variant, offers, binding: bindingByVariant.get(variant.id), profile: profileByVariant.get(variant.id) }) : null;
        })
        .filter(Boolean)
        .slice(0, Math.max(1, Math.min(Number(limit) || 500, 1000)));
      return { items, total: items.length, generatedAt: now() };
    },

    async listBindings() {
      const items = await bindingRepository.list();
      return { items, total: items.length };
    },

    async approveMapping({ variantId, providerOfferId, confirmed, version, bindingId = null, actor = {} } = {}) {
      if (confirmed !== true) throw serviceError('Admin confirmation is required before persisting a provider mapping.', 'ADMIN_CONFIRMATION_REQUIRED', 400);
      const { offers, binding, profile, variant } = await requireTarget(variantId);
      if (bindingId && (!binding || binding.id !== bindingId)) throw serviceError('Fulfillment binding target does not match the requested variant.', 'FULFILLMENT_BINDING_TARGET_CONFLICT', 409);
      const offer = offers.find((item) => item.id === providerOfferId);
      const requestedDays = durationDaysForVariant(variant);
      const providerDays = durationDaysForOffer(offer);
      if (!offer || offer.active !== true || providerForOffer(offer) !== 'WORLDMOVE') throw serviceError('The selected provider offer is not an active Worldmove offer.', 'PROVIDER_MAPPING_INVALID');
      if (!requestedDays || !providerDays || providerDays <= requestedDays || !isCompatibleFamily({ variant: profile ?? variant, offer })) throw serviceError('The selected provider offer is not a compatible longer fallback.', 'PROVIDER_MAPPING_INVALID');
      const exact = resolveProviderOffer({ variant, offers, fulfillmentProfile: profile, requireFulfillmentProfile: Boolean(profile) });
      if (exact.code === PROVIDER_RESOLUTION_CODES.EXACT) throw serviceError('An exact provider offer exists; a fallback mapping is not needed.', 'PROVIDER_MAPPING_INVALID');
      if (exact.code === PROVIDER_RESOLUTION_CODES.AMBIGUOUS) throw serviceError('Provider resolution is ambiguous; mapping cannot bypass the conflict.', 'PROVIDER_AMBIGUOUS', 409);
      const input = {
        variantId,
        provider: 'WORLDMOVE',
        strategy: 'MAPPED_FALLBACK',
        providerOfferId,
        familyKey: familyKeyFor(profile ?? variant),
        requestedDays,
        providerDays,
        upgradeDays: providerDays - requestedDays,
        providerSnapshotHash: providerSnapshotHashFor(offer),
      };
      const saved = binding
        ? await bindingRepository.update(binding.id, input, actor, version ?? binding.version)
        : await bindingRepository.create(input, actor);
      await audit({ event: binding ? 'catalog_fulfillment_binding_remapped' : 'catalog_fulfillment_binding_created', actorId: actor.id ?? null, bindingId: saved.id, variantId, providerOfferId, version: saved.version, at: now() });
      return saved;
    },

    async changeMapping(id, input, actor = {}) {
      const binding = await bindingRepository.getById(id);
      if (!binding) throw serviceError('Fulfillment binding was not found.', 'FULFILLMENT_BINDING_NOT_FOUND', 404);
      if (input.variantId && input.variantId !== binding.variantId) throw serviceError('Fulfillment binding target does not match the requested variant.', 'FULFILLMENT_BINDING_TARGET_CONFLICT', 409);
      return this.approveMapping({ ...input, variantId: binding.variantId, bindingId: id, actor, version: input.version ?? binding.version, confirmed: input.confirmed });
    },

    async revokeMapping(id, { version, confirmed } = {}, actor = {}) {
      if (confirmed !== true) throw serviceError('Admin confirmation is required before revoking a provider mapping.', 'ADMIN_CONFIRMATION_REQUIRED', 400);
      const binding = await bindingRepository.revoke(id, actor, version);
      await audit({ event: 'catalog_fulfillment_binding_revoked', actorId: actor.id ?? null, bindingId: id, version: binding.version, at: now() });
      return binding;
    },
  };
};
