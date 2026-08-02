import { fileURLToPath } from 'node:url';
import { validateProductionEnvironment } from './validateProductionEnvironment.js';
import { readJsonEvidence, safeEvidenceSummary } from './productionLaunchEvidence.js';
import { verifyProductionSecrets } from './verifyProductionSecrets.js';
import { verifyProductionAlerts } from './verifyProductionAlerts.js';

const evidence = async (env, pathEnv, name, expectedStatus = 'verified') => {
  const value = await readJsonEvidence(env[pathEnv]);
  if (!env[pathEnv]) return { name, status: 'blocked', reason: `${pathEnv}_REQUIRED` };
  if (!value) return { name, status: 'blocked', reason: `${pathEnv}_INVALID` };
  if (!value.owner || !value.approver || !safeEvidenceSummary(value).verifiedAt) return { name, status: 'blocked', reason: `${name}_METADATA_REQUIRED` };
  return value.status === expectedStatus ? { name, status: expectedStatus, summary: safeEvidenceSummary(value) } : { name, status: 'blocked', reason: `${name}_NOT_${expectedStatus.toUpperCase()}` };
};

export const validateProductionLaunch = async ({ env = process.env, environmentValidator = validateProductionEnvironment, secretsValidator = verifyProductionSecrets, alertsValidator = verifyProductionAlerts } = {}) => {
  const blockers = [];
  const environment = await environmentValidator({ env });
  if (!environment.ready) blockers.push(...environment.blockers);
  const checks = [
    { name: 'DOMAIN', value: await evidence(env, 'PRODUCTION_DOMAIN_EVIDENCE_PATH', 'DOMAIN') },
    { name: 'SECRETS', value: await secretsValidator({ env }) },
    { name: 'ALERTS', value: await alertsValidator({ env }) },
    { name: 'BACKUP', value: await evidence(env, 'PRODUCTION_BACKUP_EVIDENCE_PATH', 'BACKUP') },
    { name: 'STAGING', value: await evidence(env, 'PRODUCTION_STAGING_EVIDENCE_PATH', 'STAGING') },
    { name: 'INTERNAL', value: await evidence(env, 'PRODUCTION_INTERNAL_EVIDENCE_PATH', 'INTERNAL') },
    { name: 'CANARY', value: await evidence(env, 'PRODUCTION_CANARY_EVIDENCE_PATH', 'CANARY') },
    { name: 'ROLLBACK', value: await evidence(env, 'PRODUCTION_ROLLBACK_EVIDENCE_PATH', 'ROLLBACK') },
    { name: 'GO_NO_GO', value: await evidence(env, 'PRODUCTION_GO_NO_GO_EVIDENCE_PATH', 'GO_NO_GO', 'GO') },
    { name: 'WRITE_GATE_APPROVAL', value: await evidence(env, 'PRODUCTION_WRITE_GATE_APPROVAL_PATH', 'WRITE_GATE_APPROVAL', 'approved') },
  ];
  for (const item of checks) if (item.value.status !== (item.name === 'GO_NO_GO' ? 'GO' : item.name === 'WRITE_GATE_APPROVAL' ? 'approved' : 'verified')) blockers.push(item.value.reason ?? `${item.name}_NOT_VERIFIED`);
  const ready = blockers.length === 0 && env.PRODUCTION_LAUNCH_APPROVED === 'true';
  if (env.PRODUCTION_LAUNCH_APPROVED !== 'true') blockers.push('PRODUCTION_LAUNCH_APPROVAL_REQUIRED');
  return { status: ready ? 'ready' : 'not_ready', writesEnabled: false, blockers, environment, checks: checks.map((item) => ({ name: item.name, ...item.value })), checkedAt: new Date().toISOString(), releaseVersion: env.RELEASE_VERSION ?? null, commitSha: env.GIT_COMMIT_SHA ?? null, imageDigest: env.IMAGE_DIGEST ?? null };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await validateProductionLaunch();
  console.log(JSON.stringify(report));
  if (report.status !== 'ready') process.exitCode = 1;
}
