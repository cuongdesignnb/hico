import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProvisioningEntitlement } from './fulfillmentValidation.js';

const item = { providerWmproductId: 'WM-e-CN-500MB-1D', durationDays: 1 };

test('Worldmove callback WMID must match the sold snapshot', () => {
  assert.equal(validateProvisioningEntitlement({
    item,
    event: { itemList: [{ wmproductId: ' wm-e-cn-500mb-1d ' }] },
  }).checked, false);
  assert.throws(() => validateProvisioningEntitlement({
    item,
    event: { itemList: [{ wmproductId: 'WM-e-CN-500MB-2D' }] },
  }), (error) => error.code === 'PROVIDER_WMID_MISMATCH' && error.status === 409);
});
