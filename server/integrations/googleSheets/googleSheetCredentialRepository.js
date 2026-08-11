import {
  credentialFingerprint,
  decryptCredential,
  encryptCredential,
  maskServiceAccountEmail,
  validateServiceAccountCredential,
} from './googleSheetSecretCrypto.js';

export const createGoogleSheetCredentialRepository = ({ settingsRepository, env = process.env } = {}) => ({
  async replaceCredential({ credential, expectedVersion, actorId }) {
    const normalized = validateServiceAccountCredential(credential);
    const encryptedCredential = encryptCredential(normalized, {
      encryptionKey: env.INTEGRATION_SETTINGS_ENCRYPTION_KEY,
      keyVersion: env.INTEGRATION_SETTINGS_ENCRYPTION_KEY_VERSION ?? 'v1',
    });
    return settingsRepository.replaceCredential({
      encryptedCredential,
      credentialMasked: maskServiceAccountEmail(normalized.client_email),
      credentialFingerprint: credentialFingerprint(normalized),
      encryptionKeyVersion: encryptedCredential.keyVersion,
      expectedVersion,
      actorId,
    });
  },
  async decrypt(settings) {
    return decryptCredential(settings?.encryptedCredential, { encryptionKey: env.INTEGRATION_SETTINGS_ENCRYPTION_KEY });
  },
});
