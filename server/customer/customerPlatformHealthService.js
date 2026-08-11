import { migrationStatus } from '../scripts/migrateDatabase.js';

const enabled = (env, key) => String(env[key] ?? 'false').toLowerCase() === 'true';
const readyStatus = (value) => value?.status === 'healthy';
const availableStatus = (value) => value?.status === 'healthy' || value?.status === 'disabled';

const boundedTimeout = (value) => Math.min(Math.max(Number(value) || 3000, 250), 10000);

const withTimeout = (promise, fallback, timeoutMs) => new Promise((resolve) => {
  let settled = false;
  const timer = setTimeout(() => {
    if (!settled) { settled = true; resolve(fallback); }
  }, timeoutMs);
  Promise.resolve(promise).then((value) => {
    if (!settled) { settled = true; clearTimeout(timer); resolve(value ?? fallback); }
  }).catch(() => {
    if (!settled) { settled = true; clearTimeout(timer); resolve(fallback); }
  });
});

const safeComponent = async (service, fallback = { status: 'unavailable' }, timeoutMs = 3000, method = 'health') => {
  if (!service?.[method]) return fallback;
  return withTimeout(service[method](), fallback, timeoutMs);
};

export const createCustomerPlatformHealthService = ({
  env = process.env,
  pool,
  customerAuthReadiness,
  customerOrderRepository,
  customerDashboardService,
  customerAssetRepository,
  loyaltyService,
  referralService,
  customerNotificationService,
  customerProfileService,
  supportHealthService,
  } = {}) => ({
  async health() {
    const mode = String(env.CUSTOMER_ACCOUNT_MODE ?? 'demo').toLowerCase();
    const timeoutMs = boundedTimeout(env.CUSTOMER_PLATFORM_HEALTH_TIMEOUT_MS);
    const schema = pool
      ? await withTimeout(migrationStatus({ pool }), { status: 'unavailable', expected: [], applied: [] }, timeoutMs)
      : { status: 'unavailable', expected: [], applied: [] };
    const [auth, orders, dashboard, assets, loyalty, referrals, notifications, profile, support] = await Promise.all([
      safeComponent(customerAuthReadiness, { status: 'unavailable' }, timeoutMs, 'evaluate'),
      safeComponent(customerOrderRepository, { status: 'unavailable' }, timeoutMs),
      safeComponent(customerDashboardService, { status: 'unavailable' }, timeoutMs),
      safeComponent(customerAssetRepository, { status: 'unavailable' }, timeoutMs),
      safeComponent(loyaltyService, { status: 'disabled', enabled: false }, timeoutMs),
      safeComponent(referralService, { status: 'disabled', enabled: false }, timeoutMs),
      safeComponent(customerNotificationService, { status: 'disabled', enabled: false }, timeoutMs),
      safeComponent(customerProfileService, { status: 'disabled', enabled: false }, timeoutMs),
      safeComponent(supportHealthService, { status: 'disabled', enabled: false }, timeoutMs),
    ]);

    let quarantine = { status: 'unavailable', count: 0 };
    if (pool) {
      const result = await withTimeout(pool.query(`
          SELECT COUNT(*)::int AS count
          FROM customer_data_quarantine
          WHERE status IN ('QUARANTINED', 'MANUAL_REVIEW', 'RESOLVED', 'REJECTED')
        `), null, timeoutMs);
      if (result) quarantine = { status: 'healthy', count: result.rows[0]?.count ?? 0 };
      else quarantine = { status: 'unhealthy', count: 0 };
    }

    const mockFallbackEnabled = enabled(env, 'CUSTOMER_DEMO_FALLBACK_ENABLED');
    const legacyUserApiEnabled = enabled(env, 'LEGACY_CUSTOMER_API_ENABLED');
    const featureFlagsValid = !mockFallbackEnabled && !legacyUserApiEnabled;
    const coreReady = mode === 'real'
      && schema.status === 'current'
      && readyStatus(auth)
      && readyStatus(orders)
      && readyStatus(dashboard)
      && readyStatus(assets)
      && readyStatus(notifications)
      && readyStatus(profile)
      && readyStatus(support)
      && quarantine.status === 'healthy'
      && featureFlagsValid;

    return {
      status: coreReady ? 'healthy' : 'not_ready',
      mode,
      migrationsCurrent: schema.status === 'current',
      auth: readyStatus(auth),
      orders: readyStatus(orders),
      dashboard: readyStatus(dashboard),
      assets: readyStatus(assets),
      loyalty: { available: Boolean(loyaltyService) && availableStatus(loyalty), enabled: enabled(env, 'LOYALTY_ENABLED') },
      referrals: { available: Boolean(referralService) && availableStatus(referrals), enabled: enabled(env, 'REFERRAL_ENABLED') },
      notifications: readyStatus(notifications),
      profile: readyStatus(profile),
      support: readyStatus(support),
      mockFallbackEnabled,
      legacyUserApiEnabled,
      quarantineHealthy: quarantine.status === 'healthy',
      quarantineCount: quarantine.count,
      featureFlagsValid,
      blockers: [
        ...(mode !== 'real' ? ['CUSTOMER_ACCOUNT_MODE_REAL_REQUIRED'] : []),
        ...(schema.status !== 'current' ? ['CUSTOMER_PLATFORM_MIGRATIONS_NOT_CURRENT'] : []),
        ...(!featureFlagsValid ? ['CUSTOMER_PLATFORM_FALLBACK_OR_LEGACY_API_ENABLED'] : []),
        ...(quarantine.status !== 'healthy' ? ['CUSTOMER_PLATFORM_QUARANTINE_UNHEALTHY'] : []),
        ...(!readyStatus(auth) ? ['CUSTOMER_PLATFORM_AUTH_NOT_READY'] : []),
        ...(!readyStatus(orders) ? ['CUSTOMER_PLATFORM_ORDERS_NOT_READY'] : []),
        ...(!readyStatus(dashboard) ? ['CUSTOMER_PLATFORM_DASHBOARD_NOT_READY'] : []),
        ...(!readyStatus(assets) ? ['CUSTOMER_PLATFORM_ASSETS_NOT_READY'] : []),
        ...(!readyStatus(notifications) ? ['CUSTOMER_PLATFORM_NOTIFICATIONS_NOT_READY'] : []),
        ...(!readyStatus(profile) ? ['CUSTOMER_PLATFORM_PROFILE_NOT_READY'] : []),
        ...(!readyStatus(support) ? ['CUSTOMER_PLATFORM_SUPPORT_NOT_READY'] : []),
      ],
    };
  },
});
