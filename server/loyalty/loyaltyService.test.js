import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoyaltyService } from './loyaltyService.js';

const make = ({ enabled = true, order } = {}) => {
  const entries = [];
  const repository = {
    async ensureAccount() {},
    async insertEntry(entry) {
      const previous = entries.find((item) => item.idempotencyKey === entry.idempotencyKey);
      if (previous) return { entry: previous, idempotent: true };
      entries.push({ ...entry, id: `entry-${entries.length + 1}`, effectiveAt: entry.effectiveAt, createdAt: entry.effectiveAt });
      return { entry: entries.at(-1), idempotent: false };
    },
    async getBalance() { return { balance: entries.reduce((sum, entry) => sum + entry.points, 0), earned: 0, redeemed: 0, reversed: 0, reserved: 0, entryCount: entries.length }; },
    async listTransactions() { return { items: entries, pagination: { page: 1, pageSize: 20, totalItems: entries.length, totalPages: 1 } }; },
    async findEarnEntry() { return entries.find((entry) => entry.type === 'EARN') ?? null; },
    async reverseEntry({ originalId, customerId, reason, idempotencyKey }) {
      const key = idempotencyKey ?? `reverse:${originalId}:${reason}`;
      const previous = entries.find((entry) => entry.idempotencyKey === key);
      if (previous) return { entry: previous, idempotent: true };
      const original = entries.find((entry) => entry.id === originalId && entry.customerId === customerId);
      const entry = { id: `entry-${entries.length + 1}`, customerId, type: 'REVERSE', points: -Math.abs(original.points), idempotencyKey: key, effectiveAt: '2026-08-02T00:00:00.000Z', createdAt: '2026-08-02T00:00:00.000Z' };
      entries.push(entry);
      return { entry, idempotent: false };
    },
    async health() { return { status: 'healthy' }; },
  };
  const ruleService = { enabled, async health() { return { status: enabled ? 'healthy' : 'disabled', enabled }; }, async getActiveRule() { return { rule_id: 'catalog_fulfillment', version: 'v1' }; }, async publicRules() { return { items: [] }; } };
  return { service: createLoyaltyService({ repository, ruleService, orderRepository: { async get() { return order; } }, now: () => new Date('2026-08-02T00:00:00.000Z') }), entries };
};

test('earn is scoped to owned orders and is idempotent', async () => {
  const order = { orderId: 'o-1', customerId: 'c-1', ownershipStatus: 'OWNED', status: 'PROVISIONED', currency: 'VND', items: [{ operation: 'esim', unitPrice: 100000, quantity: 1 }] };
  const { service, entries } = make({ order });
  const input = { orderId: 'o-1', orderItemId: 'o-1:item:0', milestone: 'PROVISIONED', eventId: 'event-1' };
  const first = await service.earnForFulfillment(input);
  const retry = await service.earnForFulfillment(input);
  assert.equal(first.entry.points, 10);
  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(entries.length, 1);
});

test('earn fails closed for unresolved ownership and wrong milestone', async () => {
  const unresolved = make({ order: { orderId: 'o-2', customerId: null, ownershipStatus: 'LEGACY_UNRESOLVED', currency: 'VND', items: [{ operation: 'esim', unitPrice: 100000, quantity: 1 }] } });
  assert.deepEqual(await unresolved.service.earnForFulfillment({ orderId: 'o-2', orderItemId: 'o-2:item:0', milestone: 'PROVISIONED' }), { skipped: true, reason: 'ORDER_OWNERSHIP_UNRESOLVED' });
  const wrongMilestone = make({ order: { orderId: 'o-3', customerId: 'c-3', ownershipStatus: 'OWNED', currency: 'VND', items: [{ operation: 'device_sale', unitPrice: 100000, quantity: 1 }] } });
  assert.deepEqual(await wrongMilestone.service.earnForFulfillment({ orderId: 'o-3', orderItemId: 'o-3:item:0', milestone: 'PROVISIONED' }), { skipped: true, reason: 'MILESTONE_NOT_ELIGIBLE' });
});

test('disabled loyalty produces no ledger writes', async () => {
  const { service, entries } = make({ enabled: false, order: { orderId: 'o-4', customerId: 'c-4', ownershipStatus: 'OWNED', currency: 'VND', items: [{ operation: 'esim', unitPrice: 100000, quantity: 1 }] } });
  assert.deepEqual(await service.earnForFulfillment({ orderId: 'o-4', orderItemId: 'o-4:item:0', milestone: 'PROVISIONED' }), { skipped: true, reason: 'LOYALTY_DISABLED' });
  assert.equal(entries.length, 0);
});

test('fulfillment reversal appends a compensating entry once', async () => {
  const order = { orderId: 'o-5', customerId: 'c-5', ownershipStatus: 'OWNED', currency: 'VND', items: [{ operation: 'esim', unitPrice: 100000, quantity: 1 }] };
  const { service, entries } = make({ order });
  await service.earnForFulfillment({ orderId: 'o-5', orderItemId: 'o-5:item:0', milestone: 'PROVISIONED' });
  const first = await service.reverseForFulfillment({ orderId: 'o-5', orderItemId: 'o-5:item:0', eventId: 'refund-1' });
  const second = await service.reverseForFulfillment({ orderId: 'o-5', orderItemId: 'o-5:item:0', eventId: 'refund-1' });
  assert.equal(first.entry.points, -10);
  assert.equal(second.idempotent, true);
  assert.equal(entries.length, 2);
});
