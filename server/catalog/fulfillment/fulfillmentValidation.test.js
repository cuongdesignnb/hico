import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProvisioningEntitlement } from './fulfillmentValidation.js';

const item = { soldDurationDays: 1, providerDurationDays: 2 };

test('callback entitlement must not be shorter than sold duration or provider snapshot', () => {
  assert.deepEqual(validateProvisioningEntitlement({ item, event: { salePlanDays: 2 } }), { checked: true, salePlanDays: 2 });
  assert.throws(() => validateProvisioningEntitlement({ item, event: { salePlanDays: 1 } }), (error) => error.code === 'PROVISIONING_ENTITLEMENT_MISMATCH');
  assert.throws(() => validateProvisioningEntitlement({ item, event: { salePlanDays: 3 } }), (error) => error.code === 'PROVISIONING_ENTITLEMENT_MISMATCH');
  assert.deepEqual(validateProvisioningEntitlement({ item, event: { providerOrderId: 'order-1' } }), { checked: false, salePlanDays: null });
});
