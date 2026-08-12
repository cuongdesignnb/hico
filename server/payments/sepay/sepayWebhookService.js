import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { hashBankAccount } from './sepaySettingsService.js';
import { SePaySettingsError } from './sepayErrors.js';

const MAX_TIMESTAMP_DRIFT_SECONDS = 300;

export const verifySePaySignature = ({ rawBody, signature, timestamp, secret, now = Date.now() } = {}) => {
  const parsedTimestamp = Number(timestamp);
  if (!Number.isInteger(parsedTimestamp) || Math.abs(Math.floor(now / 1000) - parsedTimestamp) > MAX_TIMESTAMP_DRIFT_SECONDS) throw new SePaySettingsError('SePay webhook timestamp không hợp lệ.', { code: 'SEPAY_TIMESTAMP_INVALID', status: 401 });
  const provided = String(signature ?? '');
  if (!/^sha256=[0-9a-f]{64}$/i.test(provided)) throw new SePaySettingsError('SePay webhook signature không hợp lệ.', { code: 'SEPAY_SIGNATURE_INVALID', status: 401 });
  const expected = `sha256=${createHmac('sha256', secret).update(`${parsedTimestamp}.${Buffer.from(rawBody).toString('utf8')}`, 'utf8').digest('hex')}`;
  if (!timingSafeEqual(Buffer.from(provided.toLowerCase()), Buffer.from(expected))) throw new SePaySettingsError('SePay webhook signature không hợp lệ.', { code: 'SEPAY_SIGNATURE_INVALID', status: 401 });
  return true;
};

export const validateSePayPayload = (payload) => {
  if (!payload || typeof payload !== 'object') throw new SePaySettingsError('SePay payload không hợp lệ.', { code: 'SEPAY_PAYLOAD_INVALID', status: 400 });
  const id = String(payload.id ?? '').trim();
  const transferAmount = Number(payload.transferAmount);
  if (!id || payload.transferType !== 'in' || !Number.isSafeInteger(transferAmount) || transferAmount <= 0 || typeof payload.accountNumber !== 'string' || !payload.accountNumber.trim() || typeof payload.content !== 'string') throw new SePaySettingsError('SePay payload không hợp lệ.', { code: 'SEPAY_PAYLOAD_INVALID', status: 400 });
  return { id, transferAmount, accountNumber: payload.accountNumber.trim(), content: payload.content, code: typeof payload.code === 'string' ? payload.code.trim() : '', referenceCode: typeof payload.referenceCode === 'string' ? payload.referenceCode.trim() : null, transferType: 'in' };
};

const exactReferenceCandidates = ({ code, content }) => [...new Set([code, ...String(content).split(/\s+/)].filter(Boolean).map((value) => value.startsWith('#') ? value.slice(1) : value))];

export const createSePayWebhookService = ({ settingsRepository, credentialService, paymentRepository, env = process.env, logger = console, now = () => Date.now() } = {}) => ({
  async handle({ rawBody, signature, timestamp } = {}) {
    const settings = await settingsRepository.getSettings();
    if (!settings?.enabled || !settings.encryptedCredential) throw new SePaySettingsError('SePay webhook chưa được cấu hình.', { code: 'SEPAY_NOT_CONFIGURED', status: 503 });
    const secret = credentialService.decrypt(settings.encryptedCredential);
    verifySePaySignature({ rawBody, signature, timestamp, secret, now: now() });
    let payload;
    try { payload = validateSePayPayload(JSON.parse(Buffer.from(rawBody).toString('utf8'))); } catch (error) {
      if (error instanceof SePaySettingsError) throw error;
      throw new SePaySettingsError('SePay payload không hợp lệ.', { code: 'SEPAY_PAYLOAD_INVALID', status: 400 });
    }
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    let order = null;
    let matchedReference = null;
    for (const candidate of exactReferenceCandidates(payload)) {
      const candidateOrder = await paymentRepository.findOrder(candidate);
      if (candidateOrder) {
        order = candidateOrder;
        matchedReference = candidate;
        break;
      }
    }
    let outcome = 'MANUAL_REVIEW';
    if (order && (!settings.bankAccountHash || hashBankAccount(payload.accountNumber) === settings.bankAccountHash) && order.currency === 'VND' && Number(order.subtotal) === payload.transferAmount && order.payment_status !== 'PAID') outcome = 'PAID';
    const result = await paymentRepository.processPayment({
      providerTransactionId: payload.id,
      orderId: order?.order_id ?? null,
      amount: payload.transferAmount,
      accountNumber: payload.accountNumber,
      referenceCode: matchedReference ?? payload.referenceCode,
      payloadHash,
      outcome,
    });
    if (result.idempotent) return { success: true, idempotent: true };
    if (outcome !== 'PAID') logger.warn?.('[sepay] Payment received for manual review.', { reason: order ? 'amount-or-account-or-status-mismatch' : 'order-not-found', providerTransactionId: payload.id });
    return { success: true, ...(outcome !== 'PAID' ? { manualReview: true } : {}) };
  },
});
