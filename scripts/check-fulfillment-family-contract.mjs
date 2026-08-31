import assert from 'node:assert/strict';
import fs from 'node:fs';
import { familyKeyFor, isCompatibleFamily } from '../server/catalog/fulfillment/providerOfferFamily.js';
import { toPublicVariant } from '../server/catalog/public/publicProductSerializer.js';

const familyKeySource = fs.readFileSync(new URL('../server/catalog/fulfillment/providerOfferFamily.js', import.meta.url), 'utf8');
const familyKeyBlock = familyKeySource.split('export const familyKeyFor =')[1]?.split('export const compatibilityFields =')[0] ?? '';
for (const forbidden of ['durationDays', 'price', 'wmproductId', 'providerProductName', 'rowNumber']) {
  assert.equal(familyKeyBlock.includes(forbidden), false, `family key must not use ${forbidden}`);
}
assert.equal(familyKeySource.includes('source.familyKey'), false, 'family key must not accept client-controlled explicit keys');

const base = {
  providerEligibility: 'WORLDMOVE',
  regionCode: 'CN',
  medium: 'ESIM',
  dataPolicy: 'DAILY_QUOTA:500:MB:DAY',
  speedPolicy: 'THROTTLE_KBPS:128:AFTER_QUOTA',
  operationType: 'DATA_ONLY',
  durationDays: 2,
  price: 80000,
  wmproductId: 'WM-e-CN-500MB-2D',
};
assert.equal(familyKeyFor({ ...base, durationDays: 1, price: 70000, wmproductId: 'WM-e-CN-500MB-1D' }), familyKeyFor({ ...base, durationDays: 3, price: 90000, wmproductId: 'WM-e-CN-500MB-3D' }));
assert.equal(isCompatibleFamily({ variant: base, offer: { ...base, durationDays: 3, provider: 'worldmove' } }), true);
assert.equal(isCompatibleFamily({ variant: base, offer: { ...base, medium: 'PHYSICAL_SIM' } }), false);
assert.equal(familyKeyFor({ ...base, regionCode: null }), null);

const publicVariant = toPublicVariant({
  id: 'var-qa', productId: 'product-qa', sku: 'QA-1', price: 1000, currency: 'VND', medium: 'esim', active: true,
  supplier: 'worldmove', fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM', providerOfferId: 'private-offer', wmproductId: 'WM-private',
}, { providerOffers: [{ id: 'private-offer', apnHint: 'internet', networkLabel: 'LTE' }] });
const serialized = JSON.stringify(publicVariant);
for (const forbidden of ['providerOfferId', 'wmproductId', 'providerWmproductId', 'familyKey', 'providerSnapshotHash']) assert.equal(serialized.includes(forbidden), false, `public payload leaked ${forbidden}`);

console.log(JSON.stringify({ ok: true, checks: ['structured-family-key', 'required-fields', 'guardrails', 'public-leak-scan'] }));
