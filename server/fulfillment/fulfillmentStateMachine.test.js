import assert from 'node:assert/strict';
import test from 'node:test';
import { transitionFulfillment } from './fulfillmentStateMachine.js';
import { transitionOrder } from '../orders/orderStateMachine.js';

test('fulfillment and order state machines allow forward idempotent transitions only', () => {
  const record = { state: 'PENDING_CALLBACK' };
  assert.equal(transitionFulfillment(record, 'PROVISIONED', 'callback').state, 'PROVISIONED');
  assert.throws(() => transitionFulfillment({ state: 'PROVISIONED' }, 'PENDING_CALLBACK', 'retry'), (error) => error.code === 'ORDER_STATE_CONFLICT');
  assert.equal(transitionOrder({ status: 'PENDING_SHIP' }, 'SHIPPED', 'shipping').status, 'SHIPPED');
  assert.throws(() => transitionOrder({ status: 'CANCELLED' }, 'PROVISIONED', 'callback'), (error) => error.code === 'ORDER_STATE_CONFLICT');
});

test('allows a provider callback to fail a pending fulfillment', () => {
  assert.equal(transitionFulfillment({ state: 'PENDING_CALLBACK' }, 'FAILED', 'provider_callback').state, 'FAILED');
});
