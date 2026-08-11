import { createCipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploadsRoot = path.join(serverRoot, 'uploads');
const tables = [
  'schema_migrations', 'admin_users', 'admin_roles', 'admin_permissions', 'admin_role_permissions', 'admin_user_roles', 'admin_sessions',
  'customers', 'customer_profiles', 'customer_sessions', 'customer_email_verifications', 'customer_password_resets', 'customer_security_events', 'customer_addresses', 'customer_contact_changes',
  'orders', 'order_items', 'guest_order_claims', 'order_ownership_events',
  'catalog_variant_fulfillment_bindings', 'catalog_variant_fulfillment_binding_events',
  'loyalty_accounts', 'loyalty_rules', 'loyalty_ledger',
  'referral_codes', 'referral_relationships', 'referral_events', 'referral_rewards',
  'customer_notifications', 'support_tickets', 'support_ticket_messages', 'support_attachments', 'customer_data_quarantine',
];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const keyFor = (value) => scryptSync(value, 'hico-backup-v1', 32);

const jsonFiles = async (directory, prefix = '') => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await jsonFiles(path.join(directory, entry.name), relative));
    else if (entry.name.endsWith('.json') && !['api_config.json', 'admin_users.json', 'admin_sessions.json'].includes(entry.name)) files.push(relative);
  }
  return files;
};

export const createEncryptedBackup = async ({ env = process.env, outputDirectory = env.BACKUP_OUTPUT_DIR || path.join(serverRoot, 'backups') } = {}) => {
  if (!env.BACKUP_ENCRYPTION_KEY || env.BACKUP_ENCRYPTION_KEY.length < 24) throw Object.assign(new Error('BACKUP_ENCRYPTION_KEY must be configured.'), { code: 'BACKUP_ENCRYPTION_KEY_REQUIRED' });
  const files = await jsonFiles(uploadsRoot);
  const payload = { createdAt: new Date().toISOString(), files: {}, databaseAuth: {} };
  for (const relative of files) payload.files[relative.replaceAll('\\', '/')] = await fs.readFile(path.join(uploadsRoot, relative), 'utf8');
  if (env.DATABASE_URL) {
    const pool = createPostgresPool({ env });
    try { for (const table of tables) payload.databaseAuth[table] = (await pool.query(`SELECT * FROM ${table}`)).rows; } finally { await pool.end(); }
  }
  const plaintext = Buffer.from(JSON.stringify(payload));
  const compressed = gzipSync(plaintext);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(env.BACKUP_ENCRYPTION_KEY), iv);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const document = {
    format: 'hico-encrypted-backup-v1', createdAt: payload.createdAt, encryption: 'aes-256-gcm',
    iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64'),
    ciphertextSha256: sha256(ciphertext), fileCount: files.length, databaseTables: Object.keys(payload.databaseAuth),
  };
  await fs.mkdir(outputDirectory, { recursive: true });
  const filename = `hico-${payload.createdAt.replace(/[:.]/g, '-')}.backup.json`;
  const outputPath = path.join(outputDirectory, filename);
  await fs.writeFile(outputPath, `${JSON.stringify(document)}\n`, { mode: 0o600 });
  return { status: 'created', outputPath, createdAt: payload.createdAt, fileCount: files.length, databaseTables: document.databaseTables };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await createEncryptedBackup()));
