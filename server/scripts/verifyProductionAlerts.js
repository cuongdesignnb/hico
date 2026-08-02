import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { safeTimestamp } from './productionLaunchEvidence.js';

export const requiredAlertNames = ['production_readiness_fail', 'session_store_unavailable', 'database_unavailable', 'catalog_checksum_failure', 'checkout_error_rate', 'provider_timeout', 'webhook_invalid_signature', 'webhook_replay', 'pending_fulfillment', 'manual_qr_unavailable', 'physical_stock_unavailable', 'backup_failure', 'restore_verification_failure', 'http_5xx_rate', 'latency_high', 'storage_pressure', 'certificate_expiry'];

export const verifyProductionAlerts = async ({ env = process.env, readFile = fs.readFile } = {}) => {
  const blockers = [];
  let document = null;
  if (!env.ALERT_DELIVERY_EVIDENCE_PATH) blockers.push('ALERT_DELIVERY_EVIDENCE_REQUIRED');
  else {
    try { document = JSON.parse(await readFile(env.ALERT_DELIVERY_EVIDENCE_PATH, 'utf8')); } catch { blockers.push('ALERT_DELIVERY_EVIDENCE_INVALID'); }
  }
  const events = new Map((Array.isArray(document?.events) ? document.events : []).map((event) => [event.name, event]));
  for (const name of requiredAlertNames) {
    const event = events.get(name);
    if (!event?.generated || !event.delivered || !event.acknowledged || !safeTimestamp(event.testedAt)) blockers.push(`ALERT_NOT_VERIFIED:${name}`);
  }
  if (!document?.channel || !document?.onCall || !document?.backupOnCall || !document?.runbookBaseUrl || !document?.owner || !document?.approver || !safeTimestamp(document?.acknowledgedAt)) blockers.push('ALERT_ON_CALL_METADATA_REQUIRED');
  return { status: blockers.length ? 'blocked' : 'verified', blockers, checkedAt: new Date().toISOString(), channel: document?.channel ?? null, onCall: document?.onCall ?? null, backupOnCall: document?.backupOnCall ?? null, runbookBaseUrl: document?.runbookBaseUrl ?? null, acknowledgedAt: safeTimestamp(document?.acknowledgedAt), owner: document?.owner ?? env.PRODUCTION_OPERATIONS_OWNER ?? null, approver: document?.approver ?? env.PRODUCTION_OPERATIONS_APPROVER ?? null };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await verifyProductionAlerts();
  console.log(JSON.stringify(report));
  if (report.status !== 'verified') process.exitCode = 1;
}
