import { itemOperation, requiredMilestoneFor } from '../loyalty/loyaltyRules.js';
import { parseReferralQuery, assertReferralCode } from './referralValidation.js';

const isEnabled = (env) => String(env.REFERRAL_ENABLED ?? 'false').toLowerCase() === 'true';
const coded = (code, message, status = 503) => Object.assign(new Error(message), { code, status });
const disabled = () => coded('REFERRAL_DISABLED', 'Referral rewards are unavailable.', 503);
const notReady = () => coded('REFERRAL_NOT_READY', 'Referral rewards are not ready.', 503);
const safeRelationship = (relationship) => relationship ? ({ id: relationship.id, role: relationship.role, status: relationship.status, code: relationship.role === 'REFERRER' ? relationship.code : null, createdAt: relationship.createdAt, qualifiedAt: relationship.qualifiedAt, reversedAt: relationship.reversedAt }) : null;

export const createReferralService = ({ repository, codeService, loyaltyRepository, ruleService, orderRepository, notificationEventProcessor, env = process.env, audit = () => {}, logger = console, now = () => new Date() } = {}) => {
  const enabled = isEnabled(env);
  const ready = async () => {
    if (!enabled) throw disabled();
    const health = await ruleService.referralHealth();
    const loyalty = await ruleService.health();
    if (health.status !== 'healthy' || loyalty.status !== 'healthy') throw notReady();
    const rule = await ruleService.getReferralRule();
    if (!rule) throw notReady();
    return rule;
  };
  const notify = async (customerId, type, relationshipId, orderId = null) => {
    if (!notificationEventProcessor || !customerId) return;
    await notificationEventProcessor.emit({ customerId, type, entityType: 'REFERRAL_RELATIONSHIP', entityId: relationshipId, eventVersion: orderId ?? 'v1', actionPath: '/tai-khoan/gioi-thieu' });
  };
  const rewardPoints = (rule, side) => {
    const value = Number(rule.config_jsonb?.rewardPointsBySide?.[side]);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  };
  const issueRewards = async ({ client, relationship, orderId, rule, orderItemId, eventId }) => {
    const rewards = [];
    for (const [side, customerId] of [['REFERRER', relationship.referrer_customer_id], ['REFEREE', relationship.referee_customer_id]]) {
      const points = rewardPoints(rule, side);
      if (!points) continue;
      await loyaltyRepository.ensureAccount(customerId, client);
      const key = `referral:${relationship.id}:${orderId}:${rule.version}:${side}`;
      const result = await loyaltyRepository.insertEntryInTransaction(client, {
        customerId, type: 'REFERRAL_REWARD', points, orderId, orderItemId: orderItemId ?? null,
        ruleId: rule.rule_id, ruleVersion: rule.version, businessEventKey: key, idempotencyKey: key,
        effectiveAt: now().toISOString(), metadata: { relationshipId: relationship.id, rewardSide: side, qualifyingEventId: eventId ? String(eventId).slice(0, 120) : null }, createdByType: 'SYSTEM',
      });
      await repository.createRewardReference(client, { relationshipId: relationship.id, rewardSide: side, ledgerEntryId: result.entry.id, orderId, ruleVersion: rule.version });
      rewards.push({ side, customerId, points, ledgerEntryId: result.entry.id, idempotent: result.idempotent });
    }
    return rewards;
  };

  return {
    enabled,
    async overview(customerId) {
      if (!enabled) return { enabled: false, available: false, code: null, relationships: [], generatedAt: now().toISOString() };
      await ready();
      const [code, history] = await Promise.all([codeService.getOrCreate(customerId), repository.listForCustomer(customerId, {})]);
      return { enabled: true, available: true, code, relationships: history.items.map(safeRelationship), pagination: history.pagination, generatedAt: now().toISOString() };
    },
    async code(customerId) {
      if (!enabled) return { enabled: false, available: false, code: null, generatedAt: now().toISOString() };
      await ready();
      return { enabled: true, available: true, code: await codeService.getOrCreate(customerId), generatedAt: now().toISOString() };
    },
    async history(customerId, query) {
      if (!enabled) return { enabled: false, available: false, items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }, generatedAt: now().toISOString() };
      await ready();
      const result = await repository.listForCustomer(customerId, parseReferralQuery(query));
      return { enabled: true, available: true, items: result.items.map(safeRelationship), pagination: result.pagination, generatedAt: now().toISOString() };
    },
    async apply({ customerId, code, requestId }) {
      await ready();
      const relationship = await repository.applyCode({ refereeCustomerId: customerId, code: assertReferralCode(code) });
      audit({ event: 'referral_applied', actorId: customerId, relationshipId: relationship.relationship.id, requestId });
      await notify(customerId, 'REFERRAL_APPLIED', relationship.relationship.id);
      if (relationship.manualReview) return { accepted: true, status: 'MANUAL_REVIEW', relationship: safeRelationship({ ...relationship.relationship, role: 'REFEREE' }) };
      return { accepted: true, status: relationship.relationship.status, relationship: safeRelationship({ ...relationship.relationship, role: 'REFEREE' }) };
    },
    async qualifyForFulfillment({ record, order, item, eventId = null } = {}) {
      if (!enabled) return { skipped: true, reason: 'REFERRAL_DISABLED' };
      if (!record || !order || order.ownershipStatus !== 'OWNED' || !order.customerId || String(order.status).toUpperCase() === 'CANCELLED') return { skipped: true, reason: 'REFERRAL_NOT_ELIGIBLE' };
      if (requiredMilestoneFor(item) !== record.state) return { skipped: true, reason: 'REFERRAL_NOT_ELIGIBLE' };
      const rule = await ready();
      const relationships = await repository.listForCustomer(order.customerId, { page: 1, pageSize: 50 });
      const relationship = relationships.items.find((entry) => entry.role === 'REFEREE' && ['PENDING', 'QUALIFIED', 'REWARDED'].includes(entry.status));
      if (!relationship) return { skipped: true, reason: 'REFERRAL_NOT_ELIGIBLE' };
      if (relationship.status === 'REWARDED') return { skipped: true, reason: 'ALREADY_REWARDED', idempotent: true, relationship };
      if (relationship.status !== 'PENDING') return { skipped: true, reason: 'REFERRAL_NOT_ELIGIBLE', status: relationship.status };
      const result = await repository.qualifyAndReward({ relationshipId: relationship.id, refereeCustomerId: order.customerId, orderId: order.orderId, ruleId: rule.rule_id, ruleVersion: rule.version, rewardIssuer: ({ client, relationship: row }) => issueRewards({ client, relationship: row, orderId: order.orderId, orderItemId: record.orderItemId, rule, eventId }) });
      if (result.rewarded) {
        await notify(result.relationship.referrerCustomerId ?? relationship.referrerCustomerId, 'REFERRAL_QUALIFIED', relationship.id, order.orderId);
        await notify(order.customerId, 'REFERRAL_QUALIFIED', relationship.id, order.orderId);
        for (const reward of result.rewards) await notify(reward.customerId, 'REFERRAL_REWARD', relationship.id, order.orderId);
      }
      return result;
    },
    async reverseForFulfillment({ orderId, refereeCustomerId, eventId = null } = {}) {
      if (!enabled) return { skipped: true, reason: 'REFERRAL_DISABLED' };
      const rule = await ready();
      const result = await repository.reverseRewards({ orderId, refereeCustomerId, ruleId: rule.rule_id, ruleVersion: rule.version, reverseIssuer: async ({ client, reward }) => {
        const key = `referral:${reward.relationship_id}:${orderId}:${rule.version}:reverse:${reward.reward_side}:${eventId ?? 'event'}`;
        const reversed = await loyaltyRepository.reverseEntryInTransaction(client, { originalId: reward.ledger_entry_id, customerId: reward.reward_side === 'REFERRER' ? reward.referrer_customer_id : reward.referee_customer_id, idempotencyKey: key, businessEventKey: key, reason: 'referral_qualifying_order_reversed', effectiveAt: now().toISOString() });
        return { rewardSide: reward.reward_side, ledgerEntryId: reversed.entry.id, idempotent: reversed.idempotent, customerId: reward.reward_side === 'REFERRER' ? reward.referrer_customer_id : reward.referee_customer_id };
      } });
      if (!result.skipped) {
        await notify(result.referrerCustomerId, 'LOYALTY_REVERSED', result.relationshipId, orderId);
        await notify(result.refereeCustomerId, 'LOYALTY_REVERSED', result.relationshipId, orderId);
      }
      return result;
    },
    async dashboardSummary() {
      if (!enabled) return { available: false };
      try { const health = await this.health(); return health.status === 'healthy' ? { available: true } : { available: false }; } catch { return { available: false }; }
    },
    async health() {
      if (!enabled) return { status: 'disabled', enabled: false, rule: 'disabled', persistence: 'disabled' };
      const [rule, repositoryHealth] = await Promise.all([ruleService.referralHealth(), repository.health()]);
      return { status: rule.status === 'healthy' && repositoryHealth.status === 'healthy' ? 'healthy' : 'not_ready', enabled: true, rule, persistence: repositoryHealth };
    },
    async adminList(query) { return repository.adminList(query); },
    async adminDecision({ relationshipId, status, reason, actorId, requestId }) {
      if (!String(reason ?? '').trim()) throw coded('REFERRAL_CODE_INVALID', 'Admin reason is required.', 400);
      const result = await repository.adminDecision({ relationshipId, status, reason: String(reason).trim(), actorId });
      audit({ event: 'referral_admin_decision', actorId, relationshipId, status, requestId });
      return result;
    },
    _safeRelationship: safeRelationship,
    _itemOperation: itemOperation,
  };
};
