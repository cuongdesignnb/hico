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

test('resolver chooses the shortest compatible longer duration and never a shorter offer', () => {
  const nextLonger = resolveProviderOffer({ variant: variant(3), offers: [offer(2), offer(5), offer(4)] });
  assert.equal(nextLonger.code, PROVIDER_RESOLUTION_CODES.NEXT_LONGER);
  assert.equal(nextLonger.providerDurationDays, 4);
  assert.equal(nextLonger.upgradeDays, 1);

  const tooShort = resolveProviderOffer({ variant: variant(3), offers: [offer(1), offer(2)] });
  assert.equal(tooShort.code, PROVIDER_RESOLUTION_CODES.TOO_SHORT);
  assert.equal(tooShort.providerOfferId, null);
});

test('resolver blocks conflicting candidates and family or medium mismatch', () => {
  assert.equal(
    resolveProviderOffer({ variant: variant(3), offers: [offer(4), offer(4, 'offer-4b')] }).code,
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

test('approved mapping is used only after exact resolution is absent and is revalidated', () => {
  const mapping = {
    id: 'binding-1',
    variantId: 'variant-3',
    provider: 'WORLDMOVE',
    strategy: 'MAPPED_FALLBACK',
    providerOfferId: 'offer-5',
    version: 7,
  };
  const result = resolveProviderOffer({ variant: variant(3), offers: [offer(5)], activeBinding: mapping });
  assert.equal(result.code, PROVIDER_RESOLUTION_CODES.MAPPED_FALLBACK);
  assert.equal(result.strategy, 'MAPPED_FALLBACK');
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

test('approved canonical profile resolves exact 1D and next-longer 3D without a fake 2D offer', () => {
  const exact = resolveProviderOffer({ variant: { id: 'var-1', duration: '1 Ngày' }, fulfillmentProfile: approvedProfile(1), offers: [structuredOffer(1), structuredOffer(3)] });
  assert.equal(exact.code, PROVIDER_RESOLUTION_CODES.EXACT);
  assert.equal(exact.providerWmproductId, 'WM-CN-500MB-1D');
  assert.equal(exact.upgradeDays, 0);

  const fallback = resolveProviderOffer({ variant: { id: 'var-2', duration: '2 Ngày' }, fulfillmentProfile: approvedProfile(2), offers: [structuredOffer(1), structuredOffer(3)] });
  assert.equal(fallback.code, PROVIDER_RESOLUTION_CODES.NEXT_LONGER);
  assert.equal(fallback.providerWmproductId, 'WM-CN-500MB-3D');
  assert.equal(fallback.providerDurationDays, 3);
  assert.equal(fallback.upgradeDays, 1);
});

test('resolver blocks a missing or conflicting canonical profile', () => {
  const missing = resolveProviderOffer({ variant: { id: 'var-1', duration: '1 Ngày' }, offers: [structuredOffer(1)], requireFulfillmentProfile: true });
  assert.equal(missing.code, PROVIDER_RESOLUTION_CODES.PROFILE_NOT_FOUND);
  const incomplete = resolveProviderOffer({ variant: { id: 'var-1', duration: '1 Ngày' }, fulfillmentProfile: { ...approvedProfile(1), speedPolicy: null }, offers: [structuredOffer(1)], requireFulfillmentProfile: true });
  assert.equal(incomplete.code, PROVIDER_RESOLUTION_CODES.PROFILE_INCOMPLETE);
});
