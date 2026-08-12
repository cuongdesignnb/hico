import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SePaySettingsError } from './sepayErrors.js';

const ALGORITHM = 'aes-256-gcm';
const MAX_SECRET_LENGTH = 500;

const keyBuffer = (value) => {
  const text = String(value ?? '');
  if (/^[0-9a-f]{64}$/i.test(text)) return Buffer.from(text, 'hex');
  try {
    const decoded = Buffer.from(text, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // Fall through to the validation error below.
  }
  throw new SePaySettingsError('INTEGRATION_SETTINGS_ENCRYPTION_KEY phải có 32 byte.', { code: 'SETTINGS_ENCRYPTION_KEY_INVALID', status: 503 });
};

export const validateSecret = (secret) => {
  if (typeof secret !== 'string' || secret.trim() === '' || secret.length > MAX_SECRET_LENGTH) {
    throw new SePaySettingsError('SePay secret không hợp lệ.', { code: 'SEPAY_SECRET_INVALID' });
  }
  return secret;
};

export const maskSecret = (secret) => {
  const value = validateSecret(secret);
  return `****${value.slice(-4)}`;
};

export const fingerprintSecret = (secret) => `sha256:${createHash('sha256').update(validateSecret(secret), 'utf8').digest('hex')}`;

export const encryptSecret = (secret, { encryptionKey, keyVersion = '1' } = {}) => {
  const value = validateSecret(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyBuffer(encryptionKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: String(keyVersion),
  };
};

export const decryptSecret = (document, { encryptionKey } = {}) => {
  if (!document?.iv || !document?.ciphertext || !document?.authTag) throw new SePaySettingsError('SePay credential document không hợp lệ.', { code: 'SEPAY_SECRET_DOCUMENT_INVALID', status: 500 });
  const decipher = createDecipheriv(ALGORITHM, keyBuffer(encryptionKey), Buffer.from(document.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(document.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(document.ciphertext, 'base64')), decipher.final()]).toString('utf8');
};

export const createSePayCredentialService = ({ env = process.env } = {}) => ({
  encrypt(secret) {
    const key = env.INTEGRATION_SETTINGS_ENCRYPTION_KEY;
    return encryptSecret(secret, { encryptionKey: key, keyVersion: env.INTEGRATION_SETTINGS_ENCRYPTION_KEY_VERSION ?? '1' });
  },
  decrypt(document) {
    return decryptSecret(document, { encryptionKey: env.INTEGRATION_SETTINGS_ENCRYPTION_KEY });
  },
  mask: maskSecret,
  fingerprint: fingerprintSecret,
});
