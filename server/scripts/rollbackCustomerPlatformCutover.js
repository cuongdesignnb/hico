import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(scriptDirectory, '..');
const reportDirectory = path.join(serverDirectory, 'uploads', 'cutover_reports');
const isMain = process.argv[1] === fileURLToPath(import.meta.url);

export const rollbackCustomerPlatformCutover = async ({ env = process.env, execute = false, outputPath } = {}) => {
  const blockers = [];
  if (String(env.CUSTOMER_ACCOUNT_MODE ?? 'demo').toLowerCase() !== 'real') blockers.push('CUSTOMER_ACCOUNT_MODE_REAL_REQUIRED');
  if (execute && String(env.CUSTOMER_ROLLBACK_APPROVED).toLowerCase() !== 'true') blockers.push('CUSTOMER_ROLLBACK_APPROVAL_REQUIRED');
  const report = {
    status: blockers.length ? 'blocked' : execute ? 'prepared' : 'dry_run',
    executed: execute && blockers.length === 0,
    customerMode: 'real',
    writesDisabled: true,
    privateModulesDisabled: execute && blockers.length === 0,
    demoFallbackEnabled: false,
    legacyUserApiEnabled: false,
    preserve: ['customers', 'customer_profiles', 'customer_addresses', 'customer_sessions', 'orders', 'order_ownership_events', 'customer_data_quarantine', 'loyalty_ledger', 'referral_relationships', 'customer_notifications', 'support_tickets', 'support_ticket_messages', 'support_attachments'],
    blockers,
    guidance: 'Keep real mode and PostgreSQL ownership data. Disable writes/private modules selectively; never restore the demo dashboard or auto-link unresolved orders.',
    generatedAt: new Date().toISOString(),
  };
  const target = outputPath ?? path.join(reportDirectory, `customer_platform_rollback_${Date.now()}.json`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return { ...report, reportPath: target };
};

if (isMain) {
  try {
    const result = await rollbackCustomerPlatformCutover({ execute: process.argv.includes('--execute') });
    console.log(JSON.stringify(result));
    if (result.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ status: 'blocked', code: error.code ?? 'CUSTOMER_ROLLBACK_FAILED', blockers: [error.code ?? 'CUSTOMER_ROLLBACK_FAILED'] }));
    process.exitCode = 1;
  }
}
