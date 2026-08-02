import crypto from 'node:crypto';

export const createCustomerAssetAuditRepository = ({ customerRepository, securityAudit = () => {}, now = () => new Date() } = {}) => ({
  async recordReveal({ customerId, assetId, orderId, requestId, fieldsRevealed }) {
    const fields = Array.isArray(fieldsRevealed) ? fieldsRevealed.filter((field) => typeof field === 'string').slice(0, 10) : [];
    securityAudit({ event: 'customer_asset_revealed', actorId: customerId, requestId, assetId, orderId, fieldsRevealed: fields });
    await customerRepository?.createSecurityEvent?.({
      id: crypto.randomUUID(),
      customerId,
      eventType: 'CUSTOMER_ESIM_SECRET_REVEALED',
      requestId,
      metadata: { assetId, orderId, fieldsRevealed: fields },
      createdAt: now().toISOString(),
    });
  },
});
