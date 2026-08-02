import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProductionLaunch } from './validateProductionLaunch.js';

const line = (label, value) => `| ${label} | ${value ?? '-'} |`;

export const generateProductionLaunchReport = async ({ env = process.env, validator = validateProductionLaunch } = {}) => {
  const readiness = await validator({ env });
  const launchStatus = readiness.status === 'ready' ? 'READY_FOR_APPROVED_EXECUTION' : 'NO-GO';
  const report = `# Production Launch Report\n\nGenerated at: ${readiness.checkedAt}\n\n| Item | Value |\n| --- | --- |\n${line('Launch status', launchStatus)}\n${line('Release version', readiness.releaseVersion)}\n${line('Commit SHA', readiness.commitSha)}\n${line('Image digest', readiness.imageDigest)}\n${line('Writes enabled', 'false; requires audited runtime gate')}\n${line('Go/No-Go', readiness.checks.find((item) => item.name === 'GO_NO_GO')?.status ?? 'NOT_VERIFIED')}\n\n## Checks\n\n| Check | Status | Evidence |\n| --- | --- | --- |\n${readiness.checks.map((item) => `| ${item.name} | ${item.status} | ${item.reason ?? item.summary?.reference ?? '-'} |`).join('\n')}\n\n## Blockers\n\n${readiness.blockers.length ? readiness.blockers.map((item) => `- ${item}`).join('\n') : '- None'}\n\nThis report contains metadata only. It must not contain raw secrets, session tokens, provider credentials, private keys, or customer PII. A NO-GO report is not a production launch approval.\n`;
  const reportPath = env.PRODUCTION_LAUNCH_REPORT_PATH;
  if (reportPath) { await fs.mkdir(path.dirname(reportPath), { recursive: true }); await fs.writeFile(reportPath, report, 'utf8'); }
  return { status: launchStatus, reportPath: reportPath ?? null, blockers: readiness.blockers, readiness };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await generateProductionLaunchReport();
  console.log(JSON.stringify(report));
  if (report.status !== 'READY_FOR_APPROVED_EXECUTION') process.exitCode = 1;
}
