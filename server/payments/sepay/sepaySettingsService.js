import { createHash } from 'node:crypto';
import { createSePayCredentialService } from './sepayCredentialService.js';
import { SePaySettingsError } from './sepayErrors.js';

export const normalizeBankAccount = (value) => String(value ?? '').replace(/[\s-]/g, '');
export const hashBankAccount = (value) => {
  const normalized = normalizeBankAccount(value);
  return normalized ? createHash('sha256').update(normalized, 'utf8').digest('hex') : null;
};
const maskBankAccount = (value) => {
  const normalized = normalizeBankAccount(value);
  return normalized ? `****${normalized.slice(-4)}` : null;
};
const publicSettings = (settings, env) => {
  const base = String(env.PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  return {
    enabled: settings?.enabled === true,
    provider: 'SEPAY',
    bankAccountMasked: settings?.bankAccountMasked ?? null,
    accountHolder: settings?.accountHolder ?? null,
    bankName: settings?.bankName ?? null,
    orderReferencePrefix: settings?.orderReferencePrefix ?? 'HICO',
    webhookPath: settings?.webhookPath ?? '/api/webhooks/sepay',
    webhookUrl: base ? `${base}${settings?.webhookPath ?? '/api/webhooks/sepay'}` : settings?.webhookPath ?? '/api/webhooks/sepay',
    credentialConfigured: Boolean(settings?.encryptedCredential),
    credentialMasked: settings?.credentialMasked ?? null,
    credentialFingerprint: settings?.credentialFingerprint ?? null,
    status: settings?.status ?? 'DISABLED',
    updatedAt: settings?.updatedAt ?? null,
    updatedBy: settings?.updatedBy ?? null,
    version: settings?.version ?? 1,
  };
};

export const createSePaySettingsService = ({ settingsRepository, credentialService = createSePayCredentialService(), env = process.env, audit = () => {} } = {}) => ({
  async getPublicSettings() {
    return publicSettings(await settingsRepository.getSettings(), env);
  },
  async saveSettings({ input = {}, expectedVersion, actorId, requestId } = {}) {
    const current = await settingsRepository.getSettings();
    const enabled = input.enabled === true;
    const account = input.bankAccountNumber === undefined ? null : normalizeBankAccount(input.bankAccountNumber);
    if (account !== null && !/^\d{4,34}$/.test(account)) throw new SePaySettingsError('Số tài khoản ngân hàng không hợp lệ.', { code: 'SEPAY_BANK_ACCOUNT_INVALID' });
    const prefix = String(input.orderReferencePrefix ?? current?.orderReferencePrefix ?? 'HICO').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,24}$/.test(prefix)) throw new SePaySettingsError('Prefix mã đơn hàng không hợp lệ.', { code: 'SEPAY_REFERENCE_PREFIX_INVALID' });
    const saved = await settingsRepository.saveSettings({
      expectedVersion,
      actorId,
      changes: {
        enabled,
        bankAccountMasked: account === null ? current?.bankAccountMasked ?? null : maskBankAccount(account),
        bankAccountHash: account === null ? current?.bankAccountHash ?? null : hashBankAccount(account),
        accountHolder: String(input.accountHolder ?? current?.accountHolder ?? '').trim() || null,
        bankName: String(input.bankName ?? current?.bankName ?? '').trim() || null,
        orderReferencePrefix: prefix,
      },
    });
    await settingsRepository.appendEvent({ eventType: 'SEPAY_SETTINGS_UPDATED', actorId, requestId, metadata: { enabled } });
    audit({ event: 'sepay_settings_updated', actorId, requestId, enabled });
    return publicSettings(saved, env);
  },
  async replaceCredential({ input = {}, expectedVersion, actorId, requestId } = {}) {
    const encryptedCredential = credentialService.encrypt(input.secret);
    const saved = await settingsRepository.replaceCredential({
      encryptedCredential,
      credentialMasked: credentialService.mask(input.secret),
      credentialFingerprint: credentialService.fingerprint(input.secret),
      encryptionKeyVersion: encryptedCredential.keyVersion,
      expectedVersion,
      actorId,
    });
    await settingsRepository.appendEvent({ eventType: 'SEPAY_CREDENTIAL_REPLACED', actorId, requestId, metadata: { fingerprint: saved.credentialFingerprint } });
    audit({ event: 'sepay_credential_replaced', actorId, requestId, fingerprint: saved.credentialFingerprint });
    return publicSettings(saved, env);
  },
});
