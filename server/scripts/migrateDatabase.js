import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';

const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
const migrationFiles = async () => (await fs.readdir(migrationsDirectory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();

export const migrateDatabase = async ({ pool = createPostgresPool(), migrationsPath = migrationsDirectory } = {}) => {
  const retries = Math.max(1, Number.parseInt(process.env.DATABASE_MIGRATION_CONNECT_RETRIES, 10) || 20);
  const delayMs = Math.max(50, Number.parseInt(process.env.DATABASE_MIGRATION_CONNECT_DELAY_MS, 10) || 500);
  let client;
  let connectionError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try { client = await pool.connect(); break; }
    catch (error) { connectionError = error; await new Promise((resolve) => setTimeout(resolve, delayMs)); }
  }
  if (!client) throw connectionError;
  const applied = [];
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('hico_auth_migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const done = new Set((await client.query('SELECT version FROM schema_migrations')).rows.map((row) => row.version));
    for (const file of (await fs.readdir(migrationsPath)).filter((item) => /^\d+_.+\.sql$/.test(item)).sort()) {
      if (done.has(file)) continue;
      await client.query('BEGIN');
      try {
        await client.query(await fs.readFile(path.join(migrationsPath, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    return { applied, status: 'current' };
  } finally {
    try { await client.query("SELECT pg_advisory_unlock(hashtext('hico_auth_migrations'))"); } finally { client.release(); }
  }
};

export const migrationStatus = async ({ pool = createPostgresPool() } = {}) => {
  const expected = await migrationFiles();
  try {
    const applied = new Set((await pool.query('SELECT version FROM schema_migrations')).rows.map((row) => row.version));
    const pending = expected.filter((version) => !applied.has(version));
    return { status: pending.length ? 'pending' : 'current', expected, applied: [...applied].sort(), pending };
  } catch { return { status: 'unavailable', expected, applied: [], pending: expected }; }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPostgresPool();
  const command = process.argv[2] ?? 'up';
  const result = command === 'status' ? await migrationStatus({ pool }) : await migrateDatabase({ pool });
  console.log(JSON.stringify(result));
  await pool.end();
  if (result.status !== 'current') process.exitCode = 1;
}
