import fs from 'node:fs/promises';
import { migrationStatus } from '../scripts/migrateDatabase.js';
import { sessionStoreDriver } from '../auth/session/sessionStore.js';

const configured = (value) => typeof value === 'string' && value.trim().length >= 24 && !/replace-with|changeme|example|correcthorse/i.test(value);
const withinHours = (value, hours, now) => value && Date.parse(value) >= now.getTime() - hours * 3_600_000;

const safeReport = async (filePath) => {
  if (!filePath) return null;
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); } catch { return null; }
};

export const createProductionReadinessChecks = ({ env = process.env, sessionHealthService, userRepository, catalogHealthService, checkoutHealthService, customerAuthReadiness, customerProfileHealthService, supportHealthService, loyaltyHealthService, referralHealthService, notificationHealthService, pool, now = () => new Date() } = {}) => async () => {
  if (env.NODE_ENV !== 'production') return { production: false, checks: [], failedChecks: [] };
  const checks = [];
  const add = (name, passed) => checks.push({ name, passed: Boolean(passed) });
  try { add('PUBLIC_SITE_URL_HTTPS', new URL(env.PUBLIC_SITE_URL).protocol === 'https:'); } catch { add('PUBLIC_SITE_URL_HTTPS', false); }
  add('SECURE_COOKIES', env.AUTH_COOKIE_SECURE !== 'false');
  add('SESSION_STORE_SHARED', sessionStoreDriver(env) === 'postgres');
  const sessionHealth = await sessionHealthService.getHealth();
  add('SESSION_STORE_HEALTHY', sessionHealth.status === 'healthy' && sessionHealth.multiInstanceReady);
  const userHealth = await (userRepository.health?.() ?? { status: 'unhealthy' });
  add('ADMIN_USER_STORE_HEALTHY', userHealth.status === 'healthy');
  const schema = pool ? await migrationStatus({ pool }) : { status: 'unavailable' };
  add('AUTH_SCHEMA_CURRENT', schema.status === 'current');
  if (customerAuthReadiness) {
    const customerAuth = await customerAuthReadiness.evaluate();
    add('CUSTOMER_AUTH_REAL_AND_HEALTHY', customerAuth.mode === 'real' && customerAuth.status === 'healthy');
  }
  add('SESSION_SECRET_CONFIGURED', configured(env.SESSION_SECRET));
  add('CSRF_SECRET_CONFIGURED', configured(env.CSRF_SECRET));
  add('CORS_ALLOWLIST_CONFIGURED', Boolean(String(env.CORS_ALLOWED_ORIGINS ?? '').trim()) && !String(env.CORS_ALLOWED_ORIGINS).includes('*'));
  add('WORLDMOVE_CREDENTIAL_CONFIGURED', configured(env.WORLDMOVE_TOKEN));
  add('WORLDMOVE_WEBHOOK_SECRET_CONFIGURED', configured(env.WORLDMOVE_WEBHOOK_SECRET));
  add('BOOTSTRAP_PASSWORD_REMOVED', !env.ADMIN_BOOTSTRAP_PASSWORD);
  const catalog = await catalogHealthService.getHealth();
  add('CATALOG_HEALTHY', catalog.status === 'healthy');
  const checkout = await checkoutHealthService.getHealth();
  add('CHECKOUT_HEALTHY', env.CHECKOUT_LAUNCH_REQUIRED === 'false' || checkout.status === 'healthy');
  const loyalty = loyaltyHealthService ? await loyaltyHealthService.health() : { status: 'disabled', enabled: false };
  add('LOYALTY_HEALTHY', env.LOYALTY_ENABLED !== 'true' || loyalty.status === 'healthy');
  const referrals = referralHealthService ? await referralHealthService.health() : { status: 'disabled', enabled: false };
  add('REFERRALS_HEALTHY', env.REFERRAL_ENABLED !== 'true' || referrals.status === 'healthy');
  const customerNotifications = notificationHealthService ? await notificationHealthService.health() : { status: 'disabled', enabled: false };
  add('CUSTOMER_NOTIFICATIONS_HEALTHY', env.CUSTOMER_NOTIFICATIONS_ENABLED !== 'true' || customerNotifications.status === 'healthy');
  const customerProfile = customerProfileHealthService ? await customerProfileHealthService.health() : { status: 'disabled', enabled: false };
  add('CUSTOMER_PROFILE_ENABLED', env.CUSTOMER_PROFILE_ENABLED === 'true');
  add('CUSTOMER_PROFILE_HEALTHY', env.CUSTOMER_PROFILE_ENABLED !== 'true' || customerProfile.status === 'healthy');
  add('CUSTOMER_CONTACT_CHANGE_OWNER_SCOPED', customerProfileHealthService?.contactChangeOwnerScoped === true);
  add('CUSTOMER_ADDRESS_OWNER_SCOPED', customerProfileHealthService?.addressOwnerScoped === true);
  add('CUSTOMER_PROFILE_DEMO_IMPORT_BLOCKED', customerProfileHealthService?.demoImportBlocked === true);
  add('CUSTOMER_SESSION_REVOKE_SHARED', sessionStoreDriver(env) === 'postgres');
  const customerSupport = supportHealthService ? await supportHealthService.health() : { status: 'disabled', enabled: false, publicAttachmentRoute: false, uploadAllowlist: [] };
  add('CUSTOMER_SUPPORT_ENABLED', env.CUSTOMER_SUPPORT_ENABLED === 'true');
  add('CUSTOMER_SUPPORT_HEALTHY', env.CUSTOMER_SUPPORT_ENABLED !== 'true' || customerSupport.status === 'healthy');
  add('SUPPORT_ATTACHMENTS_PRIVATE', customerSupport.publicAttachmentRoute === false);
  add('CUSTOMER_SUPPORT_IDOR_SAFE', customerSupport.ownerScoped === true);
  add('SUPPORT_ATTACHMENT_ALLOWLIST', (customerSupport.uploadAllowlist ?? []).length >= 4);
  const backup = await safeReport(env.BACKUP_VERIFICATION_PATH);
  add('BACKUP_VERIFIED', Boolean(backup?.status === 'verified' && withinHours(backup.verifiedAt, Number.parseInt(env.BACKUP_MAX_AGE_HOURS, 10) || 24, now())));
  const dependency = await safeReport(env.DEPENDENCY_GATE_REPORT_PATH);
  add('DEPENDENCY_GATE_PASS', dependency?.status === 'pass');
  const rotations = await safeReport(env.SECRET_ROTATION_METADATA_PATH);
  add('SECRET_ROTATION_VERIFIED', Array.isArray(rotations?.secrets) && rotations.secrets.every((item) => item.configured && item.owner && item.rotatedAt && item.oldVersionRevokedAt));
  const launchEvidence = [
    ['DOMAIN_EVIDENCE_VERIFIED', 'PRODUCTION_DOMAIN_EVIDENCE_PATH'],
    ['ALERT_DELIVERY_VERIFIED', 'ALERT_DELIVERY_EVIDENCE_PATH'],
    ['OFFSITE_BACKUP_EVIDENCE_VERIFIED', 'PRODUCTION_BACKUP_EVIDENCE_PATH'],
    ['STAGING_EVIDENCE_VERIFIED', 'PRODUCTION_STAGING_EVIDENCE_PATH'],
    ['INTERNAL_PRODUCTION_EVIDENCE_VERIFIED', 'PRODUCTION_INTERNAL_EVIDENCE_PATH'],
    ['CANARY_EVIDENCE_VERIFIED', 'PRODUCTION_CANARY_EVIDENCE_PATH'],
    ['ROLLBACK_EVIDENCE_VERIFIED', 'PRODUCTION_ROLLBACK_EVIDENCE_PATH'],
    ['GO_NO_GO_APPROVED', 'PRODUCTION_GO_NO_GO_EVIDENCE_PATH'],
    ['WRITE_GATE_APPROVED', 'PRODUCTION_WRITE_GATE_APPROVAL_PATH'],
  ];
  for (const [name, pathEnv] of launchEvidence) {
    const report = await safeReport(env[pathEnv]);
    const expected = name === 'GO_NO_GO_APPROVED' ? 'GO' : name === 'WRITE_GATE_APPROVED' ? 'approved' : 'verified';
    add(name, report?.status === expected);
  }
  const failedChecks = checks.filter((check) => !check.passed).map((check) => check.name);
  return { production: true, checks, failedChecks, sessionHealth, catalog, checkout, loyalty, referrals, customerNotifications, customerProfile, customerSupport, schema };
};
