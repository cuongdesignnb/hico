import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decryptBackup } from './backupCrypto.js';
import { readJsonEvidence, safeTimestamp } from './productionLaunchEvidence.js';

export const verifyEncryptedBackup = async ({ backupPath = process.env.BACKUP_PATH, env = process.env, reportPath = env.BACKUP_VERIFICATION_REPORT_PATH } = {}) => {
  if (!backupPath) throw Object.assign(new Error('BACKUP_PATH is required.'), { code: 'BACKUP_PATH_REQUIRED' });
  const { document, payload } = await decryptBackup({ backupPath, encryptionKey: env.BACKUP_ENCRYPTION_KEY });
  const report = { status: 'verified', backupPath: path.basename(backupPath), createdAt: document.createdAt, verifiedAt: new Date().toISOString(), fileCount: Object.keys(payload.files).length, databaseTables: Object.keys(payload.databaseAuth) };
  if (reportPath) { await fs.mkdir(path.dirname(reportPath), { recursive: true }); await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }); }
  return report;
};

export const verifyProductionBackup = async ({ env = process.env } = {}) => {
  const blockers = [];
  let verification = null;
  try { verification = await verifyEncryptedBackup({ env, reportPath: null }); }
  catch (error) { blockers.push(error.code ?? 'BACKUP_VERIFICATION_FAILED'); }
  const launchEvidence = await readJsonEvidence(env.BACKUP_LAUNCH_EVIDENCE_PATH);
  if (!launchEvidence) blockers.push('BACKUP_LAUNCH_EVIDENCE_REQUIRED');
  if (launchEvidence?.locationType !== 'offsite') blockers.push('BACKUP_OFFSITE_LOCATION_REQUIRED');
  if (!launchEvidence?.encryption || !launchEvidence?.retentionApproved || !launchEvidence?.immutability) blockers.push('BACKUP_POLICY_EVIDENCE_REQUIRED');
  if (!safeTimestamp(launchEvidence?.createdAt) || !safeTimestamp(launchEvidence?.verifiedAt)) blockers.push('BACKUP_TIMESTAMP_REQUIRED');
  if (launchEvidence?.restoreDrill?.status !== 'passed') blockers.push('BACKUP_RESTORE_DRILL_REQUIRED');
  if (!launchEvidence?.owner || !launchEvidence?.approver) blockers.push('BACKUP_OWNER_APPROVER_REQUIRED');
  return {
    status: blockers.length ? 'blocked' : 'verified', blockers, checkedAt: new Date().toISOString(),
    verification: verification ? { status: verification.status, createdAt: verification.createdAt, verifiedAt: verification.verifiedAt, fileCount: verification.fileCount, databaseTables: verification.databaseTables } : null,
    backupId: launchEvidence?.backupId ?? null, locationType: launchEvidence?.locationType ?? null, encryption: launchEvidence?.encryption ?? null,
    retention: launchEvidence?.retention ?? null, restoreDrill: launchEvidence?.restoreDrill ? { status: launchEvidence.restoreDrill.status, durationSeconds: launchEvidence.restoreDrill.durationSeconds ?? null, rpo: launchEvidence.restoreDrill.rpo ?? null, rto: launchEvidence.restoreDrill.rto ?? null } : null,
    owner: launchEvidence?.owner ?? null, approver: launchEvidence?.approver ?? null,
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = process.env.PRODUCTION_LAUNCH_BACKUP === 'true' || process.argv.includes('--launch') ? await verifyProductionBackup() : await verifyEncryptedBackup();
  console.log(JSON.stringify(report));
  if (report.status !== 'verified') process.exitCode = 1;
}
