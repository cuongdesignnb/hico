import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const configured = (value) => typeof value === 'string' && value.trim().length >= 24 && !/replace-with|changeme|example|correcthorse/i.test(value);
const readReport = async (filePath) => { try { return JSON.parse(await fs.readFile(filePath, 'utf8')); } catch { return null; } };

export const validateProductionEnvironment = async ({ env = process.env } = {}) => {
  const blockers = []; const warnings = [];
  if (env.NODE_ENV !== 'production') blockers.push('NODE_ENV_PRODUCTION_REQUIRED');
  let publicOrigin = null;
  try { publicOrigin = new URL(env.PUBLIC_SITE_URL); if (publicOrigin.protocol !== 'https:') blockers.push('PUBLIC_SITE_URL_HTTPS_REQUIRED'); } catch { blockers.push('PUBLIC_SITE_URL_REQUIRED'); }
  if (!env.VITE_PUBLIC_SITE_URL || env.VITE_PUBLIC_SITE_URL !== env.PUBLIC_SITE_URL) blockers.push('PUBLIC_SITE_URL_MISMATCH');
  if (String(env.SESSION_STORE_DRIVER ?? '').toLowerCase() !== 'postgres') blockers.push('SESSION_STORE_POSTGRES_REQUIRED');
  if (String(env.CUSTOMER_ACCOUNT_MODE ?? '').toLowerCase() !== 'real') blockers.push('CUSTOMER_ACCOUNT_MODE_REAL_REQUIRED');
  if (!env.DATABASE_URL || (env.DATABASE_SSL !== 'true' && env.DATABASE_SSL_DISABLE !== 'true')) blockers.push('DATABASE_SSL_POLICY_REQUIRED');
  if (!configured(env.SESSION_SECRET)) blockers.push('SESSION_SECRET_REQUIRED');
  if (!configured(env.CSRF_SECRET)) blockers.push('CSRF_SECRET_REQUIRED');
  if (!configured(env.CUSTOMER_SESSION_SECRET ?? env.SESSION_SECRET)) blockers.push('CUSTOMER_SESSION_SECRET_REQUIRED');
  if (!configured(env.CUSTOMER_CSRF_SECRET ?? env.CSRF_SECRET)) blockers.push('CUSTOMER_CSRF_SECRET_REQUIRED');
  if (!env.SMTP_HOST || !env.SMTP_FROM) blockers.push('CUSTOMER_EMAIL_DELIVERY_REQUIRED');
  if (!configured(env.WORLDMOVE_TOKEN)) blockers.push('WORLDMOVE_CREDENTIAL_REQUIRED');
  if (!configured(env.WORLDMOVE_WEBHOOK_SECRET)) blockers.push('WORLDMOVE_WEBHOOK_SECRET_REQUIRED');
  if (!String(env.CORS_ALLOWED_ORIGINS ?? '').trim() || String(env.CORS_ALLOWED_ORIGINS).includes('*')) blockers.push('CORS_ALLOWLIST_REQUIRED');
  if (env.ADMIN_BOOTSTRAP_PASSWORD) blockers.push('BOOTSTRAP_PASSWORD_FORBIDDEN');
  const dependency = await readReport(env.DEPENDENCY_GATE_REPORT_PATH);
  if (dependency?.status !== 'pass') blockers.push('DEPENDENCY_GATE_REQUIRED');
  const backup = await readReport(env.BACKUP_VERIFICATION_PATH);
  if (backup?.status !== 'verified') blockers.push('BACKUP_VERIFICATION_REQUIRED');
  if (!env.SECRET_ROTATION_METADATA_PATH) blockers.push('SECRET_ROTATION_METADATA_REQUIRED');
  if (env.AUTH_RUN_MIGRATIONS_ON_START === 'true') warnings.push('MIGRATIONS_SHOULD_RUN_IN_RELEASE_JOB');
  return { ready: blockers.length === 0, blockers, warnings, checkedAt: new Date().toISOString(), publicOrigin: publicOrigin?.origin ?? null };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateProductionEnvironment();
  console.log(JSON.stringify(result));
  if (!result.ready) process.exitCode = 1;
}
