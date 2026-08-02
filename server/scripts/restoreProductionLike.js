import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decryptBackup } from './backupCrypto.js';
import { createPostgresPool } from '../database/postgresPool.js';
import { migrateDatabase } from './migrateDatabase.js';

const authTableOrder = ['admin_sessions', 'admin_user_roles', 'admin_role_permissions', 'admin_permissions', 'admin_roles', 'admin_users', 'schema_migrations'];
const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
const restoreDatabase = async (payload, env) => {
  if (!env.RESTORE_DATABASE_URL) return false;
  const pool = createPostgresPool({ env: { ...env, DATABASE_URL: env.RESTORE_DATABASE_URL } });
  try {
    await migrateDatabase({ pool });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const table of authTableOrder) await client.query(`DELETE FROM ${table}`);
      for (const table of [...authTableOrder].reverse()) for (const row of payload.databaseAuth[table] ?? []) {
        const columns = Object.keys(row);
        await client.query(`INSERT INTO ${table} (${columns.map(quote).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`, columns.map((column) => row[column]));
      }
      if (env.BACKUP_RESTORE_SESSION_POLICY !== 'preserve') await client.query("UPDATE admin_sessions SET revoked_at = NOW(), revoke_reason = 'restore_policy'");
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return true;
  } finally { await pool.end(); }
};

export const restoreProductionLike = async ({ backupPath = process.env.BACKUP_PATH, env = process.env, outputDirectory = env.RESTORE_OUTPUT_DIR } = {}) => {
  if (!backupPath || !outputDirectory) throw Object.assign(new Error('BACKUP_PATH and RESTORE_OUTPUT_DIR are required.'), { code: 'RESTORE_ARGUMENTS_REQUIRED' });
  const { payload } = await decryptBackup({ backupPath, encryptionKey: env.BACKUP_ENCRYPTION_KEY });
  for (const [relative, contents] of Object.entries(payload.files)) {
    const target = path.resolve(outputDirectory, relative);
    if (!target.startsWith(`${path.resolve(outputDirectory)}${path.sep}`)) throw new Error('Unsafe restore path.');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents, 'utf8');
  }
  const databaseRestored = await restoreDatabase(payload, env);
  return { status: 'restored', restoredAt: new Date().toISOString(), fileCount: Object.keys(payload.files).length, databaseRestored, sessionPolicy: env.BACKUP_RESTORE_SESSION_POLICY ?? 'revoke_all' };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await restoreProductionLike()));
