import assert from 'node:assert/strict';
import test from 'node:test';
import { createReferralService } from './referralService.js';

const make = ({ enabled = true } = {}) => {
  const notifications = [];
  const ledger = [];
  let rewardStatus = 'PENDING';
  const rule = { rule_id: 'referral_first_qualifying_order', version: 'v1', config_jsonb: { rewardPointsBySide: { REFERRER: 50, REFEREE: 50 } } };
  const repository = {
    async listForCustomer() { return { items: [{ id: 'relationship-1', role: 'REFEREE', status: rewardStatus === 'PENDING' ? 'PENDING' : 'REWARDED', referrerCustomerId: 'customer-referrer', refereeCustomerId: 'customer-referee' }], pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 } }; },
    async qualifyAndReward({ rewardIssuer, relationship }) {
      if (rewardStatus !== 'PENDING') return { skipped: true, reason: 'ALREADY_REWARDED', idempotent: true, relationship: { id: 'relationship-1', status: 'REWARDED' } };
      const rewards = await rewardIssuer({ client: {}, relationship: { ...relationship, id: 'relationship-1', referrer_customer_id: 'customer-referrer', referee_customer_id: 'customer-referee' } });
      rewardStatus = 'REWARDED';
      return { skipped: false, qualified: true, rewarded: true, relationship: { id: 'relationship-1', referrerCustomerId: 'customer-referrer', refereeCustomerId: 'customer-referee', status: 'REWARDED' }, rewards };
    },
    async createRewardReference() {},
    async reverseRewards({ reverseIssuer }) {
      if (rewardStatus !== 'REWARDED') return { skipped: true, reason: 'REFERRAL_REWARD_NOT_FOUND' };
      rewardStatus = 'REVERSED';
      await reverseIssuer({ client: {}, reward: { relationship_id: 'relationship-1', reward_side: 'REFERRER', ledger_entry_id: 'ledger-1', referrer_customer_id: 'customer-referrer', referee_customer_id: 'customer-referee' } });
      return { skipped: false, relationshipId: 'relationship-1', referrerCustomerId: 'customer-referrer', refereeCustomerId: 'customer-referee', reversed: [] };
    },
    async health() { return { status: 'healthy' }; },
  };
  const service = createReferralService({
    repository,
    codeService: { async getOrCreate() { return { code: 'HICO-AB12CD34EF56', status: 'ACTIVE' }; } },
    loyaltyRepository: {
      async ensureAccount() {},
      async insertEntryInTransaction(_client, entry) { const result = { ...entry, id: `ledger-${ledger.length + 1}` }; ledger.push(result); return { entry: result, idempotent: false }; },
      async reverseEntryInTransaction() { return { entry: { id: 'reverse-1' }, idempotent: false }; },
    },
    ruleService: { async referralHealth() { return enabled ? { status: 'healthy' } : { status: 'disabled' }; }, async health() { return enabled ? { status: 'healthy' } : { status: 'disabled' }; }, async getReferralRule() { return rule; } },
    orderRepository: { async get() { return { orderId: 'order-1', customerId: 'customer-referee', ownershipStatus: 'OWNED', status: 'PROVISIONED', items: [{ operation: 'esim', unitPrice: 100000, quantity: 1 }] }; } },
    notificationEventProcessor: { async emit(event) { notifications.push(event); } },
    env: { REFERRAL_ENABLED: String(enabled), LOYALTY_ENABLED: 'true' },
  });
  return { service, notifications, ledger };
};

test('referral qualification rewards both parties once and emits owner-safe notifications', async () => {
  const { service, notifications, ledger } = make();
  const input = { record: { state: 'PROVISIONED', orderItemId: 'order-1:item:0' }, order: { orderId: 'order-1', customerId: 'customer-referee', ownershipStatus: 'OWNED', status: 'PROVISIONED' }, item: { operation: 'esim' }, eventId: 'event-1' };
  const first = await service.qualifyForFulfillment(input);
  const second = await service.qualifyForFulfillment(input);
  assert.equal(first.rewarded, true);
  assert.equal(ledger.length, 2);
  assert.equal(second.idempotent, true);
  assert.equal(notifications.length, 4);
  assert.equal(JSON.stringify(notifications).includes('HICO-AB12CD34EF56'), false);
});

test('referral reversal appends a ledger reversal once and disabled mode writes nothing', async () => {
  const active = make();
  await active.service.qualifyForFulfillment({ record: { state: 'PROVISIONED', orderItemId: 'order-1:item:0' }, order: { orderId: 'order-1', customerId: 'customer-referee', ownershipStatus: 'OWNED', status: 'PROVISIONED' }, item: { operation: 'esim' } });
  const reversed = await active.service.reverseForFulfillment({ orderId: 'order-1', refereeCustomerId: 'customer-referee', eventId: 'refund-1' });
  assert.equal(reversed.skipped, false);
  const disabled = make({ enabled: false });
  assert.deepEqual(await disabled.service.qualifyForFulfillment({ record: { state: 'PROVISIONED' }, order: {}, item: { operation: 'esim' } }), { skipped: true, reason: 'REFERRAL_DISABLED' });
  assert.equal(disabled.ledger.length, 0);
});
