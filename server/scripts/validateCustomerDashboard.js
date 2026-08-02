import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = ['src/pages/account/AccountOverviewPage.tsx', 'src/pages/account/AccountOrdersPage.tsx', 'src/pages/account/AccountOrderDetailPage.tsx', 'src/services/customerDashboardApi.ts', 'src/services/customerOrdersApi.ts'];

export const validateCustomerDashboard = async () => {
  const source = (await Promise.all(files.map((file) => fs.readFile(path.join(root, file), 'utf8')))).join('\n');
  const findings = [];
  if (source.includes('/api/user')) findings.push('ACCOUNT_LEGACY_USER_API_REFERENCE');
  if (/qrcodeContent|redemptionCode|pin1|pin2|puk1|puk2|\b\d{16,22}\b/.test(source)) findings.push('ACCOUNT_RAW_ASSET_MARKER');
  return { status: findings.length ? 'fail' : 'pass', findings, ownerScoped: true, writesToSource: false };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateCustomerDashboard();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== 'pass') process.exitCode = 1;
}
