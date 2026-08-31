import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const MAX_CREDENTIAL_BYTES = 64 * 1024;

export class GoogleSheetSettingsError extends Error {
  constructor(message, { code = 'GOOGLE_SHEET_SETTINGS_FAILED', status = 400, details } = {}) {
    super(message);
    this.name = 'GoogleSheetSettingsError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const keyFor = (value) => {
  if (typeof value !== 'string' || value.length < 32) {
    throw new GoogleSheetSettingsError('Google Sheet encryption is not configured.', { code: 'GOOGLE_SHEET_ENCRYPTION_KEY_REQUIRED', status: 503 });
  }
  return createHash('sha256').update(value, 'utf8').digest();
};

const sortedObject = (value) => Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));

export const validateServiceAccountCredential = (input) => {
  let credential = input;
  if (typeof input === 'string') {
    if (Buffer.byteLength(input, 'utf8') > MAX_CREDENTIAL_BYTES) throw new GoogleSheetSettingsError('Google Sheet credential is too large.', { code: 'GOOGLE_SHEET_CREDENTIAL_TOO_LARGE' });
    try { credential = JSON.parse(input); } catch { throw new GoogleSheetSettingsError('Google Sheet credential JSON is invalid.', { code: 'GOOGLE_SHEET_CREDENTIAL_INVALID' }); }
  }
  if (!credential || typeof credential !== 'object' || Array.isArray(credential)) throw new GoogleSheetSettingsError('Google Sheet credential JSON is invalid.', { code: 'GOOGLE_SHEET_CREDENTIAL_INVALID' });
  const required = ['client_email', 'private_key', 'project_id'];
  if (credential.type !== 'service_account' || required.some((field) => typeof credential[field] !== 'string' || !credential[field].trim())) {
    throw new GoogleSheetSettingsError('Google Sheet service account credential is incomplete.', { code: 'GOOGLE_SHEET_CREDENTIAL_INVALID' });
  }
  if (!credential.private_key.includes('BEGIN PRIVATE KEY')) throw new GoogleSheetSettingsError('Google Sheet service account private key is invalid.', { code: 'GOOGLE_SHEET_CREDENTIAL_INVALID' });
  return {
    type: 'service_account',
    client_email: credential.client_email.trim(),
    private_key: credential.private_key,
    project_id: credential.project_id.trim(),
    token_uri: typeof credential.token_uri === 'string' && credential.token_uri.trim() ? credential.token_uri.trim() : 'https://oauth2.googleapis.com/token',
  };
};

export const credentialFingerprint = (credential) => `sha256:${createHash('sha256').update(JSON.stringify(sortedObject(credential)), 'utf8').digest('hex')}`;

export const maskServiceAccountEmail = (email) => {
  if (typeof email !== 'string' || !email.includes('@')) return 'SERVICE_ACCOUNT';
  const [local] = email.split('@');
  return `${local.slice(0, 4)}…@…`;
};

export const maskSpreadsheetId = (value) => {
  if (typeof value !== 'string' || !value) return null;
  return value.length <= 8 ? '••••' : `${value.slice(0, 4)}…${value.slice(-4)}`;
};

export const encryptCredential = (credential, { encryptionKey, keyVersion = 'v1' } = {}) => {
  const key = keyFor(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(credential), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    algorithm: ALGORITHM,
    keyVersion,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
};

export const decryptCredential = (document, { encryptionKey } = {}) => {
  if (!document || document.algorithm !== ALGORITHM || !document.iv || !document.authTag || !document.ciphertext) {
    throw new GoogleSheetSettingsError('Google Sheet credential cannot be decrypted.', { code: 'GOOGLE_SHEET_SECRET_DECRYPT_FAILED', status: 503 });
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, keyFor(encryptionKey), Buffer.from(document.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(document.authTag, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(document.ciphertext, 'base64')), decipher.final()]).toString('utf8');
    return validateServiceAccountCredential(JSON.parse(plaintext));
  } catch (error) {
    if (error instanceof GoogleSheetSettingsError && error.code === 'GOOGLE_SHEET_ENCRYPTION_KEY_REQUIRED') throw error;
    throw new GoogleSheetSettingsError('Google Sheet credential cannot be decrypted.', { code: 'GOOGLE_SHEET_SECRET_DECRYPT_FAILED', status: 503 });
  }
};

export const encryptionKeyConfigured = (env = process.env) => typeof env.INTEGRATION_SETTINGS_ENCRYPTION_KEY === 'string' && env.INTEGRATION_SETTINGS_ENCRYPTION_KEY.length >= 32;
