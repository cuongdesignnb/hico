export const createSupportHealthService = ({ supportService, attachmentService, env = process.env } = {}) => ({
  async health() {
    const enabled = String(env.CUSTOMER_SUPPORT_ENABLED ?? '').toLowerCase() === 'true';
    if (!enabled) return { status: 'disabled', enabled: false, ownerScoped: true };
    const support = await supportService?.health?.() ?? { status: 'unhealthy' };
    const attachment = await attachmentService?.health?.() ?? { status: 'unhealthy' };
    return { status: support.status === 'healthy' && attachment.status === 'healthy' ? 'healthy' : 'unhealthy', enabled: true, support, attachment, publicAttachmentRoute: false, ownerScoped: true, uploadAllowlist: attachment.uploadAllowlist ?? [] };
  },
});
