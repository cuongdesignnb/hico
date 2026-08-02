import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { configuredSecret, safeTimestamp } from './productionLaunchEvidence.js';

const requiredSecrets = ['worldmove_credential', 'worldmove_webhook', 'session_cookie', 'csrf_key', 'postgres_credential', 'backup_encryption', 'alert_provider'];
const envFor = {
  worldmove_credential: 'WORLDMOVE_TOKEN', worldmove_webhook: 'WORLDMOVE_WEBHOOK_SECRET', session_cookie: 'SESSION_SECRET', csrf_key: 'CSRF_SECRET',
  postgres_credential: 'DATABASE_URL', backup_encryption: 'BACKUP_ENCRYPTION_KEY', alert_provider: 'ALERT_WEBHOOK_URL',
};

export const verifyProductionSecrets = async ({ env = process.env, readFile = fs.readFile } = {}) => {
  const blockers = [];
  const path = env.SECRET_ROTATION_METADATA_PATH;
  let document = null;
  if (!path) blockers.push('SECRET_ROTATION_METADATA_REQUIRED');
  else {
    try { document = JSON.parse(await readFile(path, 'utf8')); } catch { blockers.push('SECRET_ROTATION_METADATA_INVALID'); }
  }
  const rows = Array.isArray(document?.secrets) ? document.secrets : [];
  const byName = new Map(rows.map((row) => [row.name, row]));
  for (const name of requiredSecrets) {
    const row = byName.get(name);
    const envValue = envFor[name] ? env[envFor[name]] : null;
    if (!row?.configured || !row.version || !row.owner || !safeTimestamp(row.rotatedAt)) blockers.push(`SECRET_ROTATION_INVALID:${name}`);
    if (!safeTimestamp(row?.oldVersionRevokedAt)) blockers.push(`SECRET_REVOCATION_INVALID:${name}`);
    if (envFor[name] && (name === 'postgres_credential' ? !envValue : !configuredSecret(envValue))) blockers.push(`SECRET_RUNTIME_INVALID:${name}`);
  }
  if (env.ADMIN_BOOTSTRAP_PASSWORD) blockers.push('BOOTSTRAP_PASSWORD_FORBIDDEN');
  if (!env.PRODUCTION_SECURITY_OWNER || !env.PRODUCTION_SECURITY_APPROVER) blockers.push('SECRET_OWNER_APPROVER_REQUIRED');
  return {
    status: blockers.length ? 'blocked' : 'verified', blockers, checkedAt: new Date().toISOString(),
    secrets: requiredSecrets.map((name) => ({ name, configured: Boolean(byName.get(name)?.configured), version: byName.get(name)?.version ?? null, rotatedAt: safeTimestamp(byName.get(name)?.rotatedAt), oldVersionRevokedAt: safeTimestamp(byName.get(name)?.oldVersionRevokedAt), owner: byName.get(name)?.owner ?? null })),
    owner: env.PRODUCTION_SECURITY_OWNER ?? null, approver: env.PRODUCTION_SECURITY_APPROVER ?? null,
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await verifyProductionSecrets();
  console.log(JSON.stringify(report));
  if (report.status !== 'verified') process.exitCode = 1;
}
