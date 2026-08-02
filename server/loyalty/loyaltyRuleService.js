import { publicRule } from './loyaltyRules.js';

const isEnabled = (env) => String(env.LOYALTY_ENABLED ?? 'false').toLowerCase() === 'true';

export const createLoyaltyRuleService = ({ pool, env = process.env, now = () => new Date() } = {}) => ({
  enabled: isEnabled(env),
  async getActiveRule() {
    if (!isEnabled(env) || !pool) return null;
    const result = await pool.query(`
      SELECT rule_id, version, enabled, operation, currency, earn_basis,
             points_per_currency_unit, rounding_mode, effective_from, effective_to
      FROM loyalty_rules
      WHERE enabled = TRUE AND effective_from <= NOW()
        AND (effective_to IS NULL OR effective_to > NOW())
      ORDER BY effective_from DESC, version DESC
      LIMIT 1
    `);
    return result.rows[0] ?? null;
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
});
