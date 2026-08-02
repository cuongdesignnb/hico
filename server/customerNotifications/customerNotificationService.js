const TYPES = new Set(['ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ESIM_PROVISIONED', 'ESIM_PENDING_QR', 'PHYSICAL_SIM_SHIPPED', 'TOPUP_COMPLETED', 'LOYALTY_EARNED', 'LOYALTY_REVERSED', 'REFERRAL_APPLIED', 'REFERRAL_QUALIFIED', 'REFERRAL_REWARD', 'SECURITY_EVENT']);
const isEnabled = (env) => String(env.CUSTOMER_NOTIFICATIONS_ENABLED ?? 'false').toLowerCase() === 'true';
const sensitive = /(LPA:|qrcode|qr code|pin|puk|iccid|secret|password|token|full address)/i;
const invalid = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
const notReady = () => invalid('NOTIFICATIONS_NOT_READY', 'Customer notifications are not ready.', 503);

const safeInput = ({ type, title, message, actionPath, dedupeKey } = {}) => {
  if (!TYPES.has(type) || !String(title ?? '').trim() || !String(message ?? '').trim() || !String(dedupeKey ?? '').trim()) throw invalid('INVALID_NOTIFICATION_FILTER', 'Notification event is invalid.');
  if (String(title).length > 160 || String(message).length > 500 || String(dedupeKey).length > 240 || sensitive.test(`${title} ${message}`)) throw invalid('INVALID_NOTIFICATION_FILTER', 'Notification content is not allowed.');
  if (actionPath !== null && actionPath !== undefined && (!String(actionPath).startsWith('/') || String(actionPath).startsWith('//') || /[\\]|:\/\//.test(String(actionPath)))) throw invalid('INVALID_NOTIFICATION_FILTER', 'Notification action path is invalid.');
  return { type, title: String(title).trim(), message: String(message).trim(), actionPath: actionPath ?? null, dedupeKey: String(dedupeKey).trim() };
};

export const createCustomerNotificationService = ({ repository, pool, env = process.env, now = () => new Date() } = {}) => ({
  enabled: isEnabled(env),
  async create(input, executor = null) {
    if (!isEnabled(env)) throw notReady();
    const safe = safeInput(input);
    if (!input.customerId) throw invalid('INVALID_NOTIFICATION_FILTER', 'Notification customer is required.');
    const record = { ...safe, customerId: input.customerId, entityType: input.entityType ?? null, entityId: input.entityId ?? null, metadata: input.metadata ?? {}, createdAt: input.createdAt ?? now().toISOString() };
    return executor ? repository.createInTransaction(executor, record) : repository.create(record);
  },
  async createInTransaction(executor, input) { return this.create(input, executor); },
  async list(customerId, query) { if (!isEnabled(env)) throw notReady(); return { ...(await repository.list(customerId, query)), generatedAt: now().toISOString() }; },
  async unreadCount(customerId) { if (!isEnabled(env)) throw notReady(); return { unreadCount: await repository.unreadCount(customerId), generatedAt: now().toISOString() }; },
  async markRead(id, customerId) { if (!isEnabled(env)) throw notReady(); const notification = await repository.markRead(id, customerId); if (!notification) throw invalid('NOTIFICATION_NOT_OWNED', 'Notification was not found.', 404); return { notification }; },
  async readAll(customerId) { if (!isEnabled(env)) throw notReady(); return { updated: await repository.readAll(customerId), generatedAt: now().toISOString() }; },
  async dashboardSummary(customerId) { try { const health = await this.health(); return health.status === 'healthy' ? { available: true, unreadCount: await repository.unreadCount(customerId) } : { available: false }; } catch { return { available: false }; } },
  async health() { if (!isEnabled(env)) return { status: 'disabled', enabled: false, persistence: 'disabled' }; if (!pool) return { status: 'not_ready', enabled: true, persistence: 'database_unavailable' }; const health = await repository.health(); return { ...health, enabled: true }; },
});

export { TYPES, safeInput };
