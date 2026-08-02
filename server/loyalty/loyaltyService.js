import { randomUUID } from 'node:crypto';
import { calculateEarnPoints, isEligibleItem, itemOperation, publicRule, requiredMilestoneFor } from './loyaltyRules.js';

const coded = (code, message, status = 503) => Object.assign(new Error(message), { code, status });
const disabled = () => coded('LOYALTY_DISABLED', 'Loyalty is not available.', 503);
const notReady = () => coded('LOYALTY_NOT_READY', 'Loyalty is not ready.', 503);
const safeTransaction = (entry) => ({
  id: entry.id,
  type: entry.type,
  points: entry.points,
  orderId: entry.orderId ?? null,
  orderItemId: entry.orderItemId ?? null,
  ruleId: entry.ruleId,
  ruleVersion: entry.ruleVersion,
  effectiveAt: entry.effectiveAt,
  createdAt: entry.createdAt,
});

export const createLoyaltyService = ({ repository, ruleService, orderRepository, env = process.env, now = () => new Date(), audit = () => {} } = {}) => {
  const ready = async () => {
    if (!ruleService?.enabled) throw disabled();
    const health = await ruleService.health();
    if (health.status !== 'healthy') throw notReady();
    return ruleService.getActiveRule();
  };
  return {
    async summary(customerId) {
      await ready();
      return { balance: await repository.getBalance(customerId), rules: (await ruleService.publicRules()).items, generatedAt: now().toISOString() };
    },
    async transactions(customerId, query) { await ready(); return { ...(await repository.listTransactions(customerId, query)), generatedAt: now().toISOString() }; },
    async publicRules() {
      if (!ruleService?.enabled) return { enabled: false, items: [publicRule({})], generatedAt: now().toISOString() };
      const health = await ruleService.health();
      if (health.status !== 'healthy') throw notReady();
      return ruleService.publicRules();
    },
    async dashboardSummary(customerId) {
      try {
        await ready();
        return { available: true, balance: (await repository.getBalance(customerId)).balance };
      } catch { return { available: false }; }
    },
    async health() {
      const rules = await ruleService.health();
      if (rules.status !== 'healthy') return { status: rules.status, enabled: rules.enabled, rules, ledger: rules.enabled ? await repository.health() : { status: 'disabled' }, reconciliation: 'not_run' };
      const ledger = await repository.health();
      return { status: ledger.status === 'healthy' ? 'healthy' : 'not_ready', enabled: true, rules, ledger, reconciliation: 'available' };
    },
    async earnForFulfillment({ orderId, orderItemId, milestone, eventId = null } = {}) {
      if (!ruleService?.enabled) return { skipped: true, reason: 'LOYALTY_DISABLED' };
      const rule = await ready();
      const order = await orderRepository?.get(orderId);
      if (!order || order.ownershipStatus !== 'OWNED' || !order.customerId) return { skipped: true, reason: 'ORDER_OWNERSHIP_UNRESOLVED' };
      if (String(order.status).toUpperCase() === 'CANCELLED') return { skipped: true, reason: 'ORDER_CANCELLED' };
      const itemMatch = String(orderItemId ?? '').match(/:item:(\d+)$/);
      const itemIndex = itemMatch ? Number(itemMatch[1]) : -1;
      const item = itemIndex >= 0 ? order.items?.[itemIndex] : null;
      const expectedMilestone = requiredMilestoneFor(item);
      if (!item || !expectedMilestone || milestone !== expectedMilestone) return { skipped: true, reason: 'MILESTONE_NOT_ELIGIBLE' };
      const eligibility = isEligibleItem(item, order.currency);
      if (!eligibility.eligible) return { skipped: true, reason: 'ITEM_NOT_ELIGIBLE' };
      const points = calculateEarnPoints({ unitPrice: item.unitPrice ?? item.price, quantity: item.quantity, currency: eligibility.currency });
      if (!points) return { skipped: true, reason: 'ZERO_POINTS' };
      const idempotencyKey = `earn:${orderId}:${rule.version}:${milestone}:${orderItemId}`;
      await repository.ensureAccount(order.customerId);
      const result = await repository.insertEntry({
        id: randomUUID(), customerId: order.customerId, type: 'EARN', points, orderId, orderItemId,
        ruleId: rule.rule_id, ruleVersion: rule.version, businessEventKey: idempotencyKey, idempotencyKey,
        effectiveAt: now().toISOString(), metadata: { milestone, eventId: eventId ? String(eventId).slice(0, 120) : null, operation: itemOperation(item) },
        createdByType: 'SYSTEM',
      });
      return { skipped: false, idempotent: result.idempotent, entry: safeTransaction(result.entry) };
    },
    async reverse({ entryId, customerId, reason, idempotencyKey, eventId } = {}) {
      await ready();
      const result = await repository.reverseEntry({ originalId: entryId, customerId, reason, eventId, idempotencyKey, businessEventKey: `reverse:${entryId}:${eventId ?? reason ?? 'event'}` });
      audit({ event: 'loyalty_reversal', actorId: customerId, entryId });
      return { idempotent: result.idempotent, entry: safeTransaction(result.entry) };
    },
    async reverseForFulfillment({ orderId, orderItemId, eventId, reason = 'fulfillment_reversal' } = {}) {
      if (!ruleService?.enabled) return { skipped: true, reason: 'LOYALTY_DISABLED' };
      const order = await orderRepository?.get(orderId);
      if (!order || order.ownershipStatus !== 'OWNED' || !order.customerId) return { skipped: true, reason: 'ORDER_OWNERSHIP_UNRESOLVED' };
      await ready();
      const original = await repository.findEarnEntry({ customerId: order.customerId, orderId, orderItemId });
      if (!original) return { skipped: true, reason: 'EARN_ENTRY_NOT_FOUND' };
      return this.reverse({ entryId: original.id, customerId: order.customerId, reason, eventId: eventId ?? 'unknown' });
    },
    async adminAdjust({ customerId, points, reason, idempotencyKey, actorId } = {}) {
      await ready();
      const amount = Number(points);
      if (!Number.isSafeInteger(amount) || amount === 0 || !String(reason ?? '').trim()) throw coded('LOYALTY_ADJUSTMENT_INVALID', 'Points and reason are required.', 400);
      await repository.ensureAccount(customerId);
      const result = await repository.insertEntry({
        customerId, type: 'ADJUST_ADMIN', points: amount, ruleId: 'admin_adjustment', ruleVersion: 'v1',
        businessEventKey: `adjust:${idempotencyKey}`, idempotencyKey: `adjust:${idempotencyKey}`,
        effectiveAt: now().toISOString(), metadata: { reason: String(reason).trim().slice(0, 240) }, createdByType: 'ADMIN', createdById: actorId,
      });
      audit({ event: 'loyalty_admin_adjustment', actorId, customerId, points: amount });
      return { idempotent: result.idempotent, entry: safeTransaction(result.entry) };
    },
  };
};
