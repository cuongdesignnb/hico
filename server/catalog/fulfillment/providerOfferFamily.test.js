import assert from 'node:assert/strict';
import test from 'node:test';
import {
  familyKeyFor,
  familyMetadataStatus,
  isCompatibleFamily,
} from './providerOfferFamily.js';

const family = (overrides = {}) => ({
  providerEligibility: 'WORLDMOVE',
  regionCode: 'Mainland China',
  medium: 'eSIM',
  dataPolicy: '500MB / Ngày',
  speedPolicy: '128kbps after quota',
  networkPolicy: 'China Unicom/Telecom',
  operationType: 'DATA_ONLY',
  durationDays: 2,
  price: 80000,
  wmproductId: 'WM-e-CN-500MB-2D',
  ...overrides,
});

test('family key excludes duration, price, WMID and display name', () => {
  assert.match(familyKeyFor(family({ dataPolicy: '500MB / Ng\u00e0y' })), /dataPolicy=DAILY_QUOTA:500:MB:DAY/);
  assert.equal(familyKeyFor(family({ durationDays: 1, price: 70000, wmproductId: 'WM-e-CN-500MB-1D' })), familyKeyFor(family({ durationDays: 3, price: 90000, wmproductId: 'WM-e-CN-500MB-3D' })));
});

test('structured family changes block compatibility', () => {
  assert.notEqual(familyKeyFor(family()), familyKeyFor(family({ medium: 'PHYSICAL_SIM' })));
  assert.notEqual(familyKeyFor(family()), familyKeyFor(family({ regionCode: 'JP' })));
  assert.notEqual(familyKeyFor(family()), familyKeyFor(family({ dataPolicy: '1GB / Ngày' })));
  assert.notEqual(familyKeyFor(family()), familyKeyFor(family({ speedPolicy: '5Mbps after quota' })));
  assert.equal(isCompatibleFamily({ variant: family(), offer: family({ durationDays: 3, price: 100000, wmproductId: 'WM-e-CN-500MB-3D' }) }), true);
  assert.equal(isCompatibleFamily({ variant: family(), offer: family({ regionCode: 'JP' }) }), false);
});

test('missing required structured metadata fails closed', () => {
  const status = familyMetadataStatus(family({ speedPolicy: null }));
  assert.equal(status.complete, false);
  assert.deepEqual(status.missingRequired, ['speedPolicy']);
  assert.equal(familyKeyFor(family({ speedPolicy: null })), null);
});
