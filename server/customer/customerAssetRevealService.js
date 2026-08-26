import crypto from 'node:crypto';

const stringValue = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const REVEAL_FIELDS = ['couponIccid', 'cid', 'iccid', 'qrCode', 'lpa', 'pin1', 'pin2', 'pin', 'puk1', 'puk2', 'puk', 'apn', 'confirmationCode'];

const reauthRequired = () => Object.assign(new Error('Recent customer re-authentication is required.'), { code: 'ESIM_REVEAL_REAUTH_REQUIRED' });
const unavailable = () => Object.assign(new Error('eSIM secret data is unavailable.'), { code: 'ESIM_SECRET_UNAVAILABLE' });

export const createCustomerAssetRevealService = ({ assetRepository, auditRepository, customerSessionRepository, customerRepository, securityAudit = () => {}, env = process.env, now = () => new Date() } = {}) => {
  const windowMinutes = Math.max(1, Number.parseInt(env.CUSTOMER_REAUTH_WINDOW_MINUTES, 10) || 10);
  const fallbackAuditRepository = {
    async recordReveal({ customerId, assetId, orderId, requestId, fieldsRevealed }) {
      securityAudit({ event: 'customer_asset_revealed', actorId: customerId, requestId, assetId, orderId, fieldsRevealed });
      await customerRepository?.createSecurityEvent?.({
        id: crypto.randomUUID(),
        customerId,
        eventType: 'CUSTOMER_ESIM_SECRET_REVEALED',
        requestId,
        metadata: { assetId, orderId, fieldsRevealed },
        createdAt: now().toISOString(),
      });
    },
  };

  return {
    async reveal({ customerId, session, assetId, requestId }) {
      const source = await assetRepository.sourceFor(customerId, assetId);
      if (source.asset.assetType !== 'ESIM') throw unavailable();
      const authenticatedAt = Date.parse(session?.lastAuthenticatedAt ?? '');
      if (!Number.isFinite(authenticatedAt) || now().getTime() - authenticatedAt > windowMinutes * 60_000) throw reauthRequired();
      const data = source.record.itemData && typeof source.record.itemData === 'object' ? source.record.itemData : {};
      const couponIccid = stringValue(data.couponIccid) ?? stringValue(data.iccid);
      const cid = stringValue(data.cid);
      const pin1 = stringValue(data.pin1);
      const pin2 = stringValue(data.pin2);
      const puk1 = stringValue(data.puk1);
      const puk2 = stringValue(data.puk2);
      const secrets = {
        couponIccid,
        cid,
        iccid: couponIccid,
        qrCode: stringValue(data.qrcode) ?? stringValue(data.qrCode),
        lpa: stringValue(data.qrcodeContent) ?? stringValue(data.lpa),
        pin1,
        pin2,
        pin: pin1 ?? pin2,
        puk1,
        puk2,
        puk: puk1 ?? puk2,
        apn: stringValue(data.apnExplain) ?? stringValue(data.apn),
        confirmationCode: stringValue(data.confirmationCode) ?? stringValue(data.cfCode),
      };
      const fieldsRevealed = REVEAL_FIELDS.filter((field) => secrets[field]);
      if (!fieldsRevealed.length) throw unavailable();
      await (auditRepository ?? fallbackAuditRepository).recordReveal({ customerId, assetId, orderId: source.asset.orderId, requestId, fieldsRevealed });
      return { assetId, fields: secrets, revealedAt: now().toISOString() };
    },
  };
};
