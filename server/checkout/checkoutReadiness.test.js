import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { atomicWriteJson } from '../catalog/write/catalogWritePersistence.js';
import {
  CHECKOUT_CAPABILITIES,
  CHECKOUT_FULFILLMENT_KINDS,
  classifyCartFulfillmentKinds,
  createCheckoutReadinessService,
  getRequiredCheckoutCapabilities,
  providerResolutionIsReady,
} from './checkoutReadiness.js';

const env = {
  WORLDMOVE_API_URL: 'http://worldmove.test',
  WORLDMOVE_MERCHANT_ID: 'merchant-test',
  WORLDMOVE_DEPT_ID: 'dept-test',
  WORLDMOVE_TOKEN: 'token-test',
};

const family = {
  provider: 'worldmove',
  regionCode: 'CN',
  medium: 'ESIM',
  dataPolicy: 'DAILY_QUOTA:500:MB:DAY',
  speedPolicy: 'THROTTLE_KBPS:128:AFTER_QUOTA',
  networkPolicy: 'CN_TELECOM+CN_UNICOM',
  operationType: 'DATA_ONLY',
};

const profileFor = (variantId, durationDays) => ({
  id: `profile-${variantId}`,
  variantId,
  ...family,
  durationDays,
  status: 'ACTIVE',
});

const offerFor = (id, wmproductId, durationDays) => ({
  id,
  provider: 'worldmove',
  wmproductId,
  providerProductId: `provider-${id}`,
  providerProductType: 0,
  leSIM: true,
  productRegion: 'CN',
  regionCode: 'CN',
  medium: 'ESIM',
  ...family,
  durationDays,
  active: true,
});

const offerWithoutDuration = (offer) => {
  const copy = { ...offer };
  delete copy.durationDays;
  return copy;
};

const product = (id, operation = 'new_subscription') => ({
  id,
  name: `Product ${id}`,
  operation,
  status: 'active',
});

const variant = (id, productId, overrides = {}) => ({
  id,
  productId,
  sku: `SKU-${id}`,
  price: 100000,
  currency: 'VND',
  medium: 'esim',
  supplier: 'worldmove',
  fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM',
  durationDays: 1,
  active: true,
  ...family,
  ...overrides,
});

const createService = async ({ catalog, offers = [], profiles = [], bindings = [], inventory = [], qr = [] }) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-readiness-'));
  const providerOffersFile = path.join(directory, 'provider_offers.json');
  await atomicWriteJson(providerOffersFile, offers);
  return createCheckoutReadinessService({
    env,
    catalogReader: { readCatalog: async () => catalog },
    providerOffersFile,
    fulfillmentBindingRepository: { listActive: async () => bindings },
    fulfillmentProfileRepository: { listActive: async () => profiles },
    inventoryRepository: { list: async () => inventory },
    manualQrRepository: { list: async () => qr },
    logger: { info() {}, warn() {} },
  });
};

test('classification derives canonical kinds and unions capabilities in stable order', () => {
  const catalog = {
    products: [product('p-esim'), product('p-device', 'device_sale'), product('p-topup', 'topup')],
    variants: [
      variant('v-esim', 'p-esim'),
      variant('v-physical', 'p-esim', { medium: 'physical_sim', fulfillmentMethod: 'HICO_PHYSICAL_STOCK' }),
      variant('v-device', 'p-device', { medium: 'physical_sim', fulfillmentMethod: 'HICO_PHYSICAL_STOCK' }),
      variant('v-topup', 'p-topup', { fulfillmentMethod: 'WORLDMOVE_TOPUP' }),
    ],
  };
  const classified = classifyCartFulfillmentKinds({
    catalog,
    items: [
      { variantId: 'v-topup', medium: 'esim' },
      { variantId: 'v-device', medium: 'esim' },
      { variantId: 'v-physical', medium: 'esim' },
      { variantId: 'v-esim', medium: 'physical_sim' },
    ],
  });

  assert.deepEqual(classified.cartKinds, [
    CHECKOUT_FULFILLMENT_KINDS.ESIM,
    CHECKOUT_FULFILLMENT_KINDS.PHYSICAL_SIM,
    CHECKOUT_FULFILLMENT_KINDS.DEVICE,
    CHECKOUT_FULFILLMENT_KINDS.TOPUP,
  ]);
  assert.deepEqual(getRequiredCheckoutCapabilities(classified.cartKinds), [
    CHECKOUT_CAPABILITIES.ESIM_FULFILLMENT,
    CHECKOUT_CAPABILITIES.PROVIDER_OR_MANUAL_QR,
    CHECKOUT_CAPABILITIES.PHYSICAL_INVENTORY,
    CHECKOUT_CAPABILITIES.SHIPPING,
    CHECKOUT_CAPABILITIES.DEVICE_INVENTORY,
  ]);
  assert.equal(classified.classifications.find((item) => item.variantId === 'v-esim').kind, CHECKOUT_FULFILLMENT_KINDS.ESIM);
  assert.equal(classified.classifications.find((item) => item.variantId === 'v-physical').kind, CHECKOUT_FULFILLMENT_KINDS.PHYSICAL_SIM);
});

test('pure 1D eSIM is ready without physical inventory', async () => {
  const service = await createService({
    catalog: { products: [product('p-esim')], variants: [variant('v-esim', 'p-esim')] },
    offers: [offerFor('offer-1d', 'WM-e-CN-500MB-1D', 1)],
    profiles: [profileFor('v-esim', 1)],
  });
  const readiness = await service.evaluate({ items: [{ variantId: 'v-esim', quantity: 1 }] });

  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.cartKinds, ['ESIM']);
  assert.equal(readiness.blockingReasons.length, 0);
  assert.equal(readiness.requiredCapabilities.includes(CHECKOUT_CAPABILITIES.PHYSICAL_INVENTORY), false);
});

test('checkout blocks a provider-unresolved draft variant before fulfillment lookup', async () => {
  const service = await createService({
    catalog: {
      products: [product('p-esim')],
      variants: [variant('v-unresolved', 'p-esim', {
        supplier: 'other', fulfillmentMethod: 'MANUAL_PROCESSING', active: false, needsReview: true,
      })],
    },
    offers: [],
  });
  const readiness = await service.evaluate({ items: [{ variantId: 'v-unresolved', quantity: 1 }] });
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.blockingReasons, ['CANONICAL_VARIANT_NOT_READY']);
});

test('pure 2D eSIM is blocked when only a longer provider offer exists', async () => {
  const service = await createService({
    catalog: { products: [product('p-esim')], variants: [variant('v-esim-2d', 'p-esim', { durationDays: 2 })] },
    offers: [offerFor('offer-1d', 'WM-e-CN-500MB-1D', 1), offerFor('offer-3d', 'WM-e-CN-500MB-3D', 3)],
    profiles: [profileFor('v-esim-2d', 2)],
  });
  const readiness = await service.evaluate({ items: [{ variantId: 'v-esim-2d', quantity: 1 }] });

  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.blockingReasons, ['ESIM_FULFILLMENT_NOT_READY']);
});

test('physical checkout blocks only on physical inventory and mixed carts retain that blocker', async () => {
  const catalog = {
    products: [product('p-esim')],
    variants: [
      variant('v-esim', 'p-esim'),
      variant('v-physical', 'p-esim', { medium: 'physical_sim', fulfillmentMethod: 'HICO_PHYSICAL_STOCK' }),
    ],
  };
  const service = await createService({
    catalog,
    offers: [offerFor('offer-1d', 'WM-e-CN-500MB-1D', 1)],
    profiles: [profileFor('v-esim', 1)],
  });

  const physical = await service.evaluate({ items: [{ variantId: 'v-physical', quantity: 1 }] });
  assert.equal(physical.ready, false);
  assert.deepEqual(physical.cartKinds, ['PHYSICAL_SIM']);
  assert.deepEqual(physical.blockingReasons, ['PHYSICAL_INVENTORY_NOT_CONFIGURED']);

  const mixed = await service.evaluate({ items: [{ variantId: 'v-esim', quantity: 1 }, { variantId: 'v-physical', quantity: 1 }] });
  assert.equal(mixed.ready, false);
  assert.deepEqual(mixed.cartKinds, ['ESIM', 'PHYSICAL_SIM']);
  assert.deepEqual(mixed.blockingReasons, ['PHYSICAL_INVENTORY_NOT_CONFIGURED']);
});

test('device readiness remains active while historical top-up checkout is retired', async () => {
  const catalog = {
    products: [product('p-device', 'device_sale'), product('p-topup', 'topup')],
    variants: [
      variant('v-device', 'p-device', { medium: 'physical_sim', fulfillmentMethod: 'HICO_PHYSICAL_STOCK' }),
      variant('v-topup', 'p-topup', { fulfillmentMethod: 'WORLDMOVE_TOPUP' }),
    ],
  };
  const service = await createService({ catalog });
  const device = await service.evaluate({ items: [{ variantId: 'v-device', quantity: 1 }] });
  const topup = await service.evaluate({ items: [{ variantId: 'v-topup', quantity: 1 }] });

  assert.deepEqual(device.blockingReasons, ['DEVICE_INVENTORY_NOT_CONFIGURED']);
  assert.deepEqual(topup.blockingReasons, ['FULFILLMENT_RETIRED']);
  assert.equal(device.blockingReasons.includes('PHYSICAL_INVENTORY_NOT_CONFIGURED'), false);
  assert.equal(topup.blockingReasons.includes('PHYSICAL_INVENTORY_NOT_CONFIGURED'), false);
});

test('eSIM provider readiness and canonical readiness remain explicit', async () => {
  const catalog = {
    products: [product('p-esim')],
    variants: [
      variant('v-esim', 'p-esim'),
      variant('v-inactive', 'p-esim', { active: false }),
      variant('v-manual', 'p-esim', { fulfillmentMethod: 'HICO_MANUAL_QR' }),
    ],
  };
  const service = await createService({ catalog, profiles: [profileFor('v-esim', 1)] });

  const missingProvider = await service.evaluate({ items: [{ variantId: 'v-esim', quantity: 1 }] });
  const inactive = await service.evaluate({ items: [{ variantId: 'v-inactive', quantity: 1 }] });
  const missingQr = await service.evaluate({ items: [{ variantId: 'v-manual', quantity: 1 }] });

  assert.deepEqual(missingProvider.blockingReasons, ['ESIM_FULFILLMENT_NOT_READY']);
  assert.deepEqual(inactive.blockingReasons, ['CANONICAL_VARIANT_NOT_READY']);
  assert.equal(missingQr.ready, true);
  assert.deepEqual(missingQr.blockingReasons, []);
});

test('manual QR eSIM readiness does not require a preloaded QR pool', async () => {
  const service = await createService({
    catalog: { products: [product('p-esim')], variants: [variant('v-manual', 'p-esim', { fulfillmentMethod: 'HICO_MANUAL_QR' })] },
    qr: [],
  });
  const readiness = await service.evaluate({ items: [{ variantId: 'v-manual', quantity: 1 }] });
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.blockingReasons, []);
});

test('SimHICO readiness requires exact provider identity but not provider duration', async () => {
  const exactVariant = variant('v-sim-hico', 'p-esim', {
    source: 'HICO_ESIM_SHEET',
    providerOfferId: 'offer-sim-hico',
    wmproductId: 'WM-E-CN-500MB-1D',
    durationDays: 1,
  });
  const exactOffer = offerWithoutDuration(offerFor('offer-sim-hico', 'WM-E-CN-500MB-1D', 1));
  const exactService = await createService({
    catalog: { products: [product('p-esim')], variants: [exactVariant] },
    offers: [exactOffer],
    profiles: [profileFor('v-sim-hico', 1)],
    bindings: [{ variantId: 'v-sim-hico', provider: 'WORLDMOVE', strategy: 'MAPPED_FALLBACK', status: 'ACTIVE', providerOfferId: 'offer-sim-hico' }],
  });
  const exact = await exactService.evaluate({ items: [{ variantId: 'v-sim-hico', quantity: 1 }] });
  assert.equal(exact.ready, true);

  const invalidOffers = [
    { ...exactOffer, wmproductId: 'WM-E-CN-500MB-2D' },
    { ...exactOffer, id: 'offer-other' },
    { ...exactOffer, leSIM: false },
    { ...exactOffer, providerProductType: 1 },
    { ...exactOffer, providerProductType: 2 },
    { ...exactOffer, active: false },
  ];
  for (const invalidOffer of invalidOffers) {
    const service = await createService({
      catalog: { products: [product('p-esim')], variants: [exactVariant] },
      offers: [invalidOffer],
    });
    const readiness = await service.evaluate({ items: [{ variantId: 'v-sim-hico', quantity: 1 }] });
    assert.equal(readiness.ready, false);
    assert.deepEqual(readiness.blockingReasons, ['ESIM_FULFILLMENT_NOT_READY']);
  }
});

test('readiness accepts only an exact provider resolution code', () => {
  assert.equal(providerResolutionIsReady({ ok: true, code: 'PROVIDER_EXACT_MATCH' }), true);
  assert.equal(providerResolutionIsReady({ ok: true, code: 'PROVIDER_NEXT_LONGER' }), false);
  assert.equal(providerResolutionIsReady({ ok: true, code: 'PROVIDER_MAPPED_FALLBACK' }), false);
});

test('readiness errors expose typed safe details and client medium cannot change classification', async () => {
  const service = await createService({
    catalog: {
      products: [product('p-esim')],
      variants: [variant('v-physical', 'p-esim', { medium: 'physical_sim', fulfillmentMethod: 'HICO_PHYSICAL_STOCK' })],
    },
  });

  await assert.rejects(
    service.assertReady({ items: [{ variantId: 'v-physical', quantity: 1, medium: 'esim', providerOffer: { wmproductId: 'fake' } }] }),
    (error) => {
      assert.equal(error.code, 'CHECKOUT_NOT_READY');
      assert.equal(error.status, 503);
      assert.deepEqual(error.details, {
        ready: false,
        cartKinds: ['PHYSICAL_SIM'],
        requiredCapabilities: ['PHYSICAL_INVENTORY', 'SHIPPING'],
        blockingReasons: ['PHYSICAL_INVENTORY_NOT_CONFIGURED'],
        warnings: [],
      });
      return true;
    },
  );
});
