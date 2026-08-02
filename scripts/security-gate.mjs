import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const acceptancePath = path.join(root, 'docs', 'security', 'DEPENDENCY_RISK_ACCEPTANCE.json');
const reportPath = process.env.SECURITY_GATE_REPORT_PATH || path.join(root, 'artifacts', 'security-gate-report.json');
const runAudit = (cwd) => {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm audit --omit=dev --json'], { cwd, encoding: 'utf8' })
    : spawnSync('npm', ['audit', '--omit=dev', '--json'], { cwd, encoding: 'utf8' });
  const output = String(result.stdout || result.stderr || '{}').trim();
  try { return JSON.parse(output); } catch { return { vulnerabilities: { audit_execution: { severity: 'high' } } }; }
};
const installedVersion = async (cwd, packageName) => {
  try { return JSON.parse(await readFile(path.join(cwd, 'node_modules', packageName, 'package.json'), 'utf8')).version; } catch { return null; }
};
const now = new Date();
const acceptances = JSON.parse(await readFile(acceptancePath, 'utf8')).records;
const audits = [{ scope: 'frontend', cwd: root }, { scope: 'backend', cwd: path.join(root, 'server') }].map((item) => ({ ...item, report: runAudit(item.cwd) }));
const findings = [];
for (const audit of audits) {
  for (const [packageName, vulnerability] of Object.entries(audit.report.vulnerabilities ?? {})) {
    const installed = await installedVersion(audit.cwd, packageName);
    const acceptance = acceptances.find((item) => item.package === packageName && item.installedVersion === installed && item.owner && item.approvedAt && item.expiresAt && Date.parse(item.expiresAt) > now.getTime());
    findings.push({ scope: audit.scope, package: packageName, installedVersion: installed, severity: vulnerability.severity, accepted: Boolean(acceptance), advisoryIds: acceptance?.advisoryIds ?? [] });
  }
}
const report = {
  status: findings.every((finding) => finding.accepted) ? 'pass' : 'fail',
  checkedAt: now.toISOString(),
  findings,
  acceptedRiskCount: findings.filter((finding) => finding.accepted).length,
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report));
if (report.status !== 'pass') process.exitCode = 1;
