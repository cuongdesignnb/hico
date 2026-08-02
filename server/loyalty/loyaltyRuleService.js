import { publicRule } from './loyaltyRules.js';

const isEnabled = (env) => String(env.LOYALTY_ENABLED ?? 'false').toLowerCase() === 'true';

export const createLoyaltyRuleService = ({ pool, env = process.env, now = () => new Date() } = {}) => ({
  enabled: isEnabled(env),
  async getActiveRule({ operation = 'catalog_fulfillment' } = {}) {
    if (!isEnabled(env) || !pool) return null;
    const result = await pool.query(`
      SELECT rule_id, version, enabled, operation, currency, earn_basis,
             points_per_currency_unit, rounding_mode, effective_from, effective_to, config_jsonb
      FROM loyalty_rules
      WHERE enabled = TRUE AND operation = $1 AND effective_from <= NOW()
        AND (effective_to IS NULL OR effective_to > NOW())
      ORDER BY effective_from DESC, version DESC
      LIMIT 1
    `, [operation]);
    return result.rows[0] ?? null;
  },
  async getReferralRule() {
    if (!isEnabled(env) || String(env.REFERRAL_ENABLED ?? 'false').toLowerCase() !== 'true') return null;
    return this.getActiveRule({ operation: 'referral_reward' });
  },
  async publicRules() {
    const rule = await this.getActiveRule();
    return { enabled: isEnabled(env) && Boolean(rule), items: [publicRule(rule ?? {})], generatedAt: now().toISOString() };
  },
  async health() {
    if (!isEnabled(env)) return { status: 'disabled', enabled: false, rules: 'disabled' };
    if (!pool) return { status: 'not_ready', enabled: true, rules: 'database_unavailable' };
    try {
      const rule = await this.getActiveRule();
      return { status: rule ? 'healthy' : 'not_ready', enabled: true, rules: rule ? 'current' : 'missing' };
    } catch { return { status: 'unhealthy', enabled: true, rules: 'unavailable' }; }
  },
  async referralHealth() {
    const referralEnabled = String(env.REFERRAL_ENABLED ?? 'false').toLowerCase() === 'true';
    if (!referralEnabled) return { status: 'disabled', enabled: false, rule: 'disabled' };
    if (!isEnabled(env) || !pool) return { status: 'not_ready', enabled: true, rule: !isEnabled(env) ? 'loyalty_disabled' : 'database_unavailable' };
    try {
      const rule = await this.getReferralRule();
      const points = rule?.config_jsonb?.rewardPointsBySide;
      const valid = rule && Number.isSafeInteger(Number(points?.REFERRER)) && Number(points.REFERRER) > 0
        && Number.isSafeInteger(Number(points?.REFEREE)) && Number(points.REFEREE) > 0;
      return { status: valid ? 'healthy' : 'not_ready', enabled: true, rule: valid ? `${rule.rule_id}/${rule.version}` : 'missing_or_invalid' };
    } catch { return { status: 'unhealthy', enabled: true, rule: 'unavailable' }; }
  },
});
