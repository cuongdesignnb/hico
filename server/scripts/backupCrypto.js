import { createDecipheriv, createHash, scryptSync } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs/promises';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const keyFor = (value) => scryptSync(value, 'hico-backup-v1', 32);

export const decryptBackup = async ({ backupPath, encryptionKey }) => {
  if (!encryptionKey) throw Object.assign(new Error('BACKUP_ENCRYPTION_KEY is required.'), { code: 'BACKUP_ENCRYPTION_KEY_REQUIRED' });
  const document = JSON.parse(await fs.readFile(backupPath, 'utf8'));
  if (document.format !== 'hico-encrypted-backup-v1') throw Object.assign(new Error('Unsupported backup format.'), { code: 'BACKUP_FORMAT_INVALID' });
  const ciphertext = Buffer.from(document.ciphertext, 'base64');
  if (sha256(ciphertext) !== document.ciphertextSha256) throw Object.assign(new Error('Backup checksum mismatch.'), { code: 'BACKUP_CHECKSUM_INVALID' });
  const decipher = createDecipheriv('aes-256-gcm', keyFor(encryptionKey), Buffer.from(document.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(document.authTag, 'base64'));
  const payload = JSON.parse(gunzipSync(Buffer.concat([decipher.update(ciphertext), decipher.final()])).toString('utf8'));
  return { document, payload };
};
