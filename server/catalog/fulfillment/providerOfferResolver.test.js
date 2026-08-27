import assert from 'node:assert/strict';
import test from 'node:test';
import { PROVIDER_RESOLUTION_CODES, resolveProviderOffer } from './providerOfferResolver.js';

const family = {
  provider: 'worldmove',
  familyKey: 'worldmove-cn-500mb',
  destination: 'cn',
  medium: 'esim',
  dataPolicy: '500mb',
  speedPolicy: '4g',
  networkPolicy: 'multi-network',
  activationPolicy: 'instant',
  resetPolicy: 'none',
  operation: 'new_subscription',
  simType: 'esim',
  leSIM: true,
};

const variant = (durationDays = 1) => ({ id: `variant-${durationDays}`, durationDays, ...family });
const offer = (durationDays, id = `offer-${durationDays}`, extra = {}) => ({
  id,
  provider: 'worldmove',
  wmproductId: `WM-CN-500MB-${durationDays}D`,
  providerProductName: `CN ${durationDays}D`,
  productRegion: 'cn',
  providerProductType: 0,
  leSIM: true,
  active: true,
  durationDays,
  ...family,
  ...extra,
});

test('resolver chooses one exact offer and records the real provider WMID', () => {
  const result = resolveProviderOffer({ variant: variant(1), offers: [offer(1), offer(2)] });
  assert.equal(result.code, PROVIDER_RESOLUTION_CODES.EXACT);
  assert.equal(result.strategy, 'EXACT');
  assert.equal(result.providerWmproductId, 'WM-CN-500MB-1D');
  assert.equal(result.upgradeDays, 0);
});

test('resolver requires the exact requested duration and never upgrades or downgrades', () => {
  const nextLonger = resolveProviderOffer({ variant: variant(3), offers: [offer(2), offer(5), offer(4)] });
  assert.equal(nextLonger.code, PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE);
  assert.equal(nextLonger.ok, false);
  assert.equal(nextLonger.providerOfferId, null);
  assert.equal(nextLonger.providerDurationDays, null);
  assert.equal(nextLonger.upgradeDays, null);

  const tooShort = resolveProviderOffer({ variant: variant(3), offers: [offer(1), offer(2)] });
  assert.equal(tooShort.code, PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE);
  assert.equal(tooShort.providerOfferId, null);
});

test('resolver blocks conflicting candidates and family or medium mismatch', () => {
  assert.equal(
    resolveProviderOffer({ variant: variant(3), offers: [offer(3), offer(3, 'offer-3b')] }).code,
    PROVIDER_RESOLUTION_CODES.AMBIGUOUS,
  );
  assert.equal(
    resolveProviderOffer({ variant: variant(1), offers: [offer(1, 'physical', { medium: 'physical_sim', simType: 'physical_sim', leSIM: false })] }).code,
    PROVIDER_RESOLUTION_CODES.MEDIUM_MISMATCH,
  );
  assert.equal(
    resolveProviderOffer({ variant: variant(1), offers: [offer(1, 'other-family', { destination: 'jp' })] }).code,
    PROVIDER_RESOLUTION_CODES.FAMILY_MISMATCH,
  );
});

test('resolver ignores Worldmove physical and top-up quotation types for new eSIM fulfillment', () => {
  const result = resolveProviderOffer({
    variant: variant(1),
    offers: [
      offer(1, 'physical-type', { providerProductType: 1, leSIM: null }),
      offer(1, 'topup-type', { providerProductType: 2, leSIM: null }),
    ],
  });
  assert.equal(result.code, PROVIDER_RESOLUTION_CODES.MEDIUM_MISMATCH);
  assert.equal(result.providerOfferId, null);
});

test('historical mapped fallback is retained as a blocking resolution', () => {
  const mapping = {
    id: 'binding-1',
    variantId: 'variant-3',
    provider: 'WORLDMOVE',
    strategy: 'MAPPED_FALLBACK',
    providerOfferId: 'offer-5',
    version: 7,
  };
  const result = resolveProviderOffer({ variant: variant(3), offers: [offer(5)], activeBinding: mapping });
  assert.equal(result.code, PROVIDER_RESOLUTION_CODES.MAPPING_INVALID);
  assert.equal(result.ok, false);
  assert.equal(result.providerOfferId, null);
  assert.equal(result.bindingVersion, 7);

  const invalid = resolveProviderOffer({ variant: variant(3), offers: [offer(4)], activeBinding: mapping });
  assert.equal(invalid.code, PROVIDER_RESOLUTION_CODES.MAPPING_INVALID);
});

const approvedProfile = (durationDays) => ({
  id: `profile-${durationDays}`,
  variantId: `var-${durationDays}`,
  provider: 'WORLDMOVE',
  regionCode: 'CN',
  medium: 'ESIM',
  dataPolicy: '500MB / Ngày',
  speedPolicy: '128kbps after quota',
  networkPolicy: 'China Unicom/Telecom',
  operationType: 'DATA_ONLY',
  durationDays,
  status: 'ACTIVE',
});

const structuredOffer = (durationDays) => offer(durationDays, `wm-${durationDays}`, {
  productRegion: 'Mainland China',
  dataPolicy: '500MB / Ngày',
  speedPolicy: '128kbps after quota',
  networkPolicy: 'China Unicom/Telecom',
  operationType: 'DATA_ONLY',
});

test('approved canonical profile resolves exact 1D but not a longer 3D for a missing 2D offer', () => {
  const exact = resolveProviderOffer({ variant: { id: 'var-1', duration: '1 Ngày' }, fulfillmentProfile: approvedProfile(1), offers: [structuredOffer(1), structuredOffer(3)] });
  assert.equal(exact.code, PROVIDER_RESOLUTION_CODES.EXACT);
  assert.equal(exact.providerWmproductId, 'WM-CN-500MB-1D');
  assert.equal(exact.upgradeDays, 0);

  const fallback = resolveProviderOffer({ variant: { id: 'var-2', duration: '2 Ngày' }, fulfillmentProfile: approvedProfile(2), offers: [structuredOffer(1), structuredOffer(3)] });
  assert.equal(fallback.code, PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE);
  assert.equal(fallback.providerOfferId, null);
  assert.equal(fallback.providerDurationDays, null);
  assert.equal(fallback.upgradeDays, null);
});

test('canonical WMID constrains the exact provider offer and duration', () => {
  const result = resolveProviderOffer({
    variant: { ...variant(1), wmproductId: ' wm-cn-500mb-1d ', providerOfferId: 'offer-1' },
    offers: [offer(1, 'offer-1'), offer(2, 'offer-2')],
  });
  assert.equal(result.code, PROVIDER_RESOLUTION_CODES.EXACT);
  assert.equal(result.providerOfferId, 'offer-1');

  const noUpgrade = resolveProviderOffer({
    variant: { ...variant(1), wmproductId: 'WM-CN-500MB-1D', providerOfferId: 'offer-1' },
    offers: [offer(2, 'offer-1')],
  });
  assert.equal(noUpgrade.code, PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE);
  assert.equal(noUpgrade.providerOfferId, null);
});

test('SimHICO resolves exact WMID without provider duration and never falls back to another WMID', () => {
  const simHicoVariant = {
    ...variant(5),
    source: 'HICO_ESIM_SHEET',
    fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM',
    providerOfferId: 'offer-sim-hico',
    wmproductId: 'WM-E-X-5D',
  };
  const exactOffer = {
    id: 'offer-sim-hico',
    provider: 'worldmove',
    wmproductId: 'WM-E-X-5D',
    providerProductType: 0,
    leSIM: true,
    active: true,
  };
  const exact = resolveProviderOffer({ variant: simHicoVariant, offers: [exactOffer] });
  assert.equal(exact.code, PROVIDER_RESOLUTION_CODES.EXACT);
  assert.equal(exact.providerOfferId, 'offer-sim-hico');
  assert.equal(exact.providerDurationDays, null);
  assert.equal(exact.upgradeDays, null);

  const noFallback = resolveProviderOffer({
    variant: simHicoVariant,
    offers: [{ ...exactOffer, wmproductId: 'WM-E-X-7D' }],
  });
  assert.equal(noFallback.code, PROVIDER_RESOLUTION_CODES.NOT_AVAILABLE);
  assert.equal(noFallback.ok, false);
  assert.equal(noFallback.providerOfferId, null);
});

test('resolver blocks a missing or conflicting canonical profile', () => {
  const missing = resolveProviderOffer({ variant: { id: 'var-1', duration: '1 Ngày' }, offers: [structuredOffer(1)], requireFulfillmentProfile: true });
  assert.equal(missing.code, PROVIDER_RESOLUTION_CODES.PROFILE_NOT_FOUND);
  const incomplete = resolveProviderOffer({ variant: { id: 'var-1', duration: '1 Ngày' }, fulfillmentProfile: { ...approvedProfile(1), speedPolicy: null }, offers: [structuredOffer(1)], requireFulfillmentProfile: true });
  assert.equal(incomplete.code, PROVIDER_RESOLUTION_CODES.PROFILE_INCOMPLETE);
});
