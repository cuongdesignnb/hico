import path from 'node:path';
import { readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { resolveProviderOffer, PROVIDER_RESOLUTION_CODES } from '../catalog/fulfillment/providerOfferResolver.js';
import { durationDaysForOffer, durationDaysForVariant, mediumForSource, providerForOffer } from '../catalog/fulfillment/providerOfferFamily.js';
import { isWorldmoveEsimOffer, matchesExactSimHicoOffer } from '../catalog/fulfillment/fulfillmentContracts.js';
import { readWorldmoveConfig } from '../providers/worldmove/worldmoveClient.js';
import { CheckoutError } from './checkoutError.js';

export const CHECKOUT_FULFILLMENT_KINDS = Object.freeze({
  ESIM: 'ESIM',
  PHYSICAL_SIM: 'PHYSICAL_SIM',
  DEVICE: 'DEVICE',
  TOPUP: 'TOPUP',
});

export const CHECKOUT_CAPABILITIES = Object.freeze({
  ESIM_FULFILLMENT: 'ESIM_FULFILLMENT',
  PROVIDER_OR_MANUAL_QR: 'PROVIDER_OR_MANUAL_QR',
  PHYSICAL_INVENTORY: 'PHYSICAL_INVENTORY',
  SHIPPING: 'SHIPPING',
  DEVICE_INVENTORY: 'DEVICE_INVENTORY',
  TOPUP_PROVIDER: 'TOPUP_PROVIDER',
});

const KIND_ORDER = [
  CHECKOUT_FULFILLMENT_KINDS.ESIM,
  CHECKOUT_FULFILLMENT_KINDS.PHYSICAL_SIM,
  CHECKOUT_FULFILLMENT_KINDS.DEVICE,
  CHECKOUT_FULFILLMENT_KINDS.TOPUP,
];

const CAPABILITY_ORDER = [
  CHECKOUT_CAPABILITIES.ESIM_FULFILLMENT,
  CHECKOUT_CAPABILITIES.PROVIDER_OR_MANUAL_QR,
  CHECKOUT_CAPABILITIES.PHYSICAL_INVENTORY,
  CHECKOUT_CAPABILITIES.SHIPPING,
  CHECKOUT_CAPABILITIES.DEVICE_INVENTORY,
  CHECKOUT_CAPABILITIES.TOPUP_PROVIDER,
];

const MESSAGE_BY_REASON = Object.freeze({
  CANONICAL_MEDIUM_UNRESOLVED: 'Canonical variant medium could not be resolved.',
  CANONICAL_OPERATION_UNRESOLVED: 'Nghiệp vụ của sản phẩm chưa được xác nhận.',
  CANONICAL_VARIANT_NOT_READY: 'Canonical variant is not ready for checkout.',
  ESIM_FULFILLMENT_NOT_READY: 'eSIM chưa sẵn sàng để cấp.',
  PHYSICAL_INVENTORY_NOT_CONFIGURED: 'Kho SIM vật lý chưa được cấu hình.',
  DEVICE_INVENTORY_NOT_CONFIGURED: 'Kho thiết bị chưa được cấu hình.',
  TOPUP_PROVIDER_NOT_READY: 'Nhà cung cấp top-up chưa sẵn sàng.',
  FULFILLMENT_RETIRED: 'Nguồn cấp này đã ngừng hỗ trợ cho đơn hàng mới.',
});

const canonicalVariantReady = ({ product, variant }) => (
  product?.status === 'active'
  && variant?.active === true
  && Number.isFinite(variant.price)
  && typeof variant.currency === 'string'
  && variant.currency.trim() !== ''
);
const asList = (value) => (Array.isArray(value) ? value : Object.values(value ?? {}));
const normalizeOperation = (value) => String(value ?? '').trim().toLowerCase();
const normalizeMedium = (value) => String(value ?? '').trim().toLowerCase();
const normalizeWmid = (value) => String(value ?? '').trim().toUpperCase();

const variantForRequest = ({ catalog, item }) => {
  const variant = asList(catalog?.variants).find((candidate) => candidate.id === item?.variantId);
  if (!variant) return null;
  const product = asList(catalog?.products).find((candidate) => candidate.id === variant.productId);
  return { item, product, variant };
};

const kindFor = ({ product, variant }) => {
  const operation = normalizeOperation(product?.operation ?? variant?.operation);
  if (operation === 'topup') return CHECKOUT_FULFILLMENT_KINDS.TOPUP;
  if (operation === 'device_sale') return CHECKOUT_FULFILLMENT_KINDS.DEVICE;
  const medium = normalizeMedium(variant?.medium);
  if (medium === 'esim') return CHECKOUT_FULFILLMENT_KINDS.ESIM;
  if (medium === 'physical_sim') return CHECKOUT_FULFILLMENT_KINDS.PHYSICAL_SIM;
  return null;
};

export const classifyCartFulfillmentKinds = ({ catalog, items = [] } = {}) => {
  const classifications = items.map((item) => {
    const resolved = variantForRequest({ catalog, item });
    return {
      variantId: item?.variantId ?? null,
      kind: resolved ? kindFor(resolved) : null,
      product: resolved?.product ?? null,
      variant: resolved?.variant ?? null,
    };
  });
  const cartKinds = KIND_ORDER.filter((kind) => classifications.some((item) => item.kind === kind));
  return { cartKinds, classifications };
};

export const getRequiredCheckoutCapabilities = (cartKinds = []) => {
  const required = new Set();
  for (const kind of cartKinds) {
    if (kind === CHECKOUT_FULFILLMENT_KINDS.ESIM) {
      required.add(CHECKOUT_CAPABILITIES.ESIM_FULFILLMENT);
      required.add(CHECKOUT_CAPABILITIES.PROVIDER_OR_MANUAL_QR);
    }
    if (kind === CHECKOUT_FULFILLMENT_KINDS.PHYSICAL_SIM) {
      required.add(CHECKOUT_CAPABILITIES.PHYSICAL_INVENTORY);
      required.add(CHECKOUT_CAPABILITIES.SHIPPING);
    }
    if (kind === CHECKOUT_FULFILLMENT_KINDS.DEVICE) {
      required.add(CHECKOUT_CAPABILITIES.DEVICE_INVENTORY);
      required.add(CHECKOUT_CAPABILITIES.SHIPPING);
    }
    // Historical top-up records remain classifiable, but never become a new checkout capability.
  }
  return CAPABILITY_ORDER.filter((capability) => required.has(capability));
};

const providerOfferForVariant = ({ variant, offers }) => {
  const requestedDays = durationDaysForVariant(variant);
  const expectsLeSIM = variant.fulfillmentMethod === 'WORLDMOVE_ESIM_REDEEM'
    ? true
    : variant.fulfillmentMethod === 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM'
      ? false
      : null;
  if (!variant.providerOfferId || !variant.wmproductId || !requestedDays || expectsLeSIM === null) return null;
  return offers.find((offer) => (
    isWorldmoveEsimOffer(offer)
    && offer.id === variant.providerOfferId
    && normalizeWmid(offer.wmproductId) === normalizeWmid(variant.wmproductId)
    && offer.leSIM === expectsLeSIM
    && durationDaysForOffer(offer) === requestedDays
  )) ?? null;
};

const expectedProviderTypeFor = (variant) => {
  if (variant?.operation === 'topup') return 2;
  if (variant?.medium === 'esim') return 0;
  if (variant?.medium === 'physical_sim') return 1;
  return null;
};

const usesProviderResolver = ({ variant, activeBinding, activeProfile }) => Boolean(
  activeProfile || variant.durationDays || variant.familyKey || activeBinding,
);

const exactSimHicoOfferForVariant = ({ variant, offers }) => {
  const requestedDays = durationDaysForVariant(variant);
  if (variant?.source !== 'HICO_ESIM_SHEET' || !variant.providerOfferId || !variant.wmproductId || !requestedDays) return null;
  return offers.find((offer) => matchesExactSimHicoOffer({ variant, offer })) ?? null;
};

const providerReadyForVariant = ({ env, variant, offers, activeBinding, activeProfile }) => {
  const method = variant.fulfillmentMethod;
  if (method === 'HICO_MANUAL_QR') return { ready: null, reason: null };
  const resolverEnabled = usesProviderResolver({ variant, activeBinding, activeProfile });
  if (!resolverEnabled && !String(method ?? '').startsWith('WORLDMOVE_')) return { ready: false, reason: 'ESIM_FULFILLMENT_NOT_READY' };
  try { readWorldmoveConfig(env); } catch { return { ready: false, reason: 'ESIM_FULFILLMENT_NOT_READY' }; }

  if (variant.source === 'HICO_ESIM_SHEET') {
    const offer = exactSimHicoOfferForVariant({ variant, offers });
    const resolution = offer ? {
      ok: true,
      code: PROVIDER_RESOLUTION_CODES.EXACT,
      strategy: 'EXACT',
      providerOfferId: offer.id,
      providerWmproductId: offer.wmproductId,
      providerDurationDays: null,
      upgradeDays: null,
    } : {
      ok: false,
      code: PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE,
      providerOfferId: null,
      providerWmproductId: null,
    };
    return {
      ready: Boolean(offer),
      reason: offer ? null : 'ESIM_FULFILLMENT_NOT_READY',
      resolution,
      offer,
    };
  }

  if (resolverEnabled) {
    const resolution = resolveProviderOffer({
      variant,
      offers,
      activeBinding,
      fulfillmentProfile: activeProfile,
      requireFulfillmentProfile: Boolean(activeProfile),
    });
    const offer = resolution.providerOfferId
      ? offers.find((candidate) => candidate.id === resolution.providerOfferId)
      : null;
    const expectedProviderType = expectedProviderTypeFor(variant);
    if (resolution.ok && expectedProviderType !== null && offer?.providerProductType !== expectedProviderType) {
      return { ready: false, reason: 'ESIM_FULFILLMENT_NOT_READY', resolution, offer };
    }
    return {
      ready: resolution.ok,
      reason: resolution.ok ? null : 'ESIM_FULFILLMENT_NOT_READY',
      resolution,
    };
  }

  const offer = providerOfferForVariant({ variant, offers });
  const expectedProviderType = expectedProviderTypeFor(variant);
  if (offer && expectedProviderType !== null && offer.providerProductType !== expectedProviderType) {
    return { ready: false, reason: 'ESIM_FULFILLMENT_NOT_READY', offer };
  }
  return {
    ready: Boolean(offer),
    reason: offer ? null : 'ESIM_FULFILLMENT_NOT_READY',
    offer,
  };
};

const inventoryMatches = ({ rows, variant }) => rows.some((row) => (
  row?.variantId === variant.id || row?.sku === variant.sku
));
const inventoryAvailable = ({ rows, variant, quantity }) => rows.some((row) => {
  if (row?.variantId !== variant.id && row?.sku !== variant.sku) return false;
  const available = Number(row.available ?? row.quantity ?? row.stock);
  return Number.isFinite(available) && available >= quantity;
});

const readinessError = (readiness) => {
  const firstReason = readiness.blockingReasons[0] ?? 'CHECKOUT_NOT_READY';
  return new CheckoutError(
    MESSAGE_BY_REASON[firstReason] ?? 'Checkout readiness requirement is not satisfied.',
    'CHECKOUT_NOT_READY',
    503,
    readiness,
  );
};

export const createCheckoutReadinessService = ({
  env = process.env,
  catalogReader,
  providerOffersFile = path.join(defaultUploadsDirectory, 'provider_offers.json'),
  fulfillmentBindingRepository = null,
  fulfillmentProfileRepository = null,
  inventoryRepository = null,
  manualQrRepository = null,
  logger = console,
} = {}) => {
  const evaluate = async (request = {}) => {
    let catalog;
    try {
      catalog = await catalogReader.readCatalog();
    } catch {
      return {
        ready: false,
        cartKinds: [],
        requiredCapabilities: [],
        blockingReasons: ['CANONICAL_VARIANT_NOT_READY'],
        warnings: [],
      };
    }

    const { cartKinds, classifications } = classifyCartFulfillmentKinds({ catalog, items: request.items });
    const requiredCapabilities = getRequiredCheckoutCapabilities(cartKinds);
    const blockingReasons = [];
    const warnings = [];
    const unresolved = classifications.some((item) => item.variant && !item.kind);
    if (unresolved) blockingReasons.push('CANONICAL_MEDIUM_UNRESOLVED');

    const [offers, bindings, profiles, inventoryRows] = await Promise.all([
      readJson(providerOffersFile, []),
      fulfillmentBindingRepository?.listActive?.('WORLDMOVE') ?? [],
      fulfillmentProfileRepository?.listActive?.('WORLDMOVE') ?? [],
      inventoryRepository?.list?.() ?? [],
    ]);
    const offerRows = asList(offers);
    const bindingRows = asList(bindings);
    const profileRows = asList(profiles);
    const inventory = asList(inventoryRows);

    for (const item of classifications) {
      if (!item.variant || !canonicalVariantReady(item)) {
        if (item.variant) blockingReasons.push('CANONICAL_VARIANT_NOT_READY');
        continue;
      }
      if (item.kind === CHECKOUT_FULFILLMENT_KINDS.TOPUP) {
        blockingReasons.push('FULFILLMENT_RETIRED');
        continue;
      }
      if (item.product.operationResolution === 'UNRESOLVED' || item.variant.operationResolution === 'UNRESOLVED') {
        blockingReasons.push('CANONICAL_OPERATION_UNRESOLVED');
        continue;
      }
      if (item.kind === CHECKOUT_FULFILLMENT_KINDS.PHYSICAL_SIM) {
        if (!inventoryMatches({ rows: inventory, variant: item.variant })) blockingReasons.push('PHYSICAL_INVENTORY_NOT_CONFIGURED');
        else if (!inventoryAvailable({ rows: inventory, variant: item.variant, quantity: Number(item.item.quantity) || 1 })) blockingReasons.push('PHYSICAL_INVENTORY_NOT_CONFIGURED');
      }
      if (item.kind === CHECKOUT_FULFILLMENT_KINDS.DEVICE) {
        if (!inventoryMatches({ rows: inventory, variant: item.variant })) blockingReasons.push('DEVICE_INVENTORY_NOT_CONFIGURED');
        else if (!inventoryAvailable({ rows: inventory, variant: item.variant, quantity: Number(item.item.quantity) || 1 })) blockingReasons.push('DEVICE_INVENTORY_NOT_CONFIGURED');
      }
      if (item.kind === CHECKOUT_FULFILLMENT_KINDS.ESIM) {
        const activeBinding = bindingRows.find((binding) => binding.variantId === item.variant.id && binding.status === 'ACTIVE') ?? null;
        const activeProfile = profileRows.find((profile) => profile.variantId === item.variant.id && profile.status === 'ACTIVE') ?? null;
        if (item.variant.fulfillmentMethod === 'HICO_MANUAL_QR') {
          // Manual QR is assigned after checkout. An empty pool intentionally
          // produces PENDING_QR_ASSIGN instead of blocking the purchase.
        } else {
          const provider = providerReadyForVariant({ env, variant: item.variant, offers: offerRows, activeBinding, activeProfile });
          if (provider.ready === false) blockingReasons.push(provider.reason ?? 'ESIM_FULFILLMENT_NOT_READY');
        }
      }
    }

    const result = {
      ready: blockingReasons.length === 0,
      cartKinds,
      requiredCapabilities,
      blockingReasons: [...new Set(blockingReasons)],
      warnings,
    };
    logger.info?.(JSON.stringify({ event: 'checkout_request_readiness', ...result }));
    return result;
  };

  return {
    evaluate,
    async assertReady(request) {
      const readiness = await evaluate(request);
      if (!readiness.ready) throw readinessError(readiness);
      return readiness;
    },
  };
};

export const checkoutReadinessMessage = (reason) => MESSAGE_BY_REASON[reason] ?? null;
export const providerResolutionIsReady = (resolution) => Boolean(
  resolution?.ok
  && resolution.code === PROVIDER_RESOLUTION_CODES.EXACT,
);
export const requestedDurationForReadiness = (variant) => durationDaysForVariant(variant);
export const canonicalMediumForReadiness = (value) => mediumForSource(value);
export const canonicalProviderForReadiness = (value) => providerForOffer(value);
