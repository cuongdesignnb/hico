import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');
const [backend, diagnostics, frontend, checkout] = await Promise.all([
  read('server/catalog/sheetSync/catalogResyncService.js'),
  read('server/catalog/sheetSync/catalogResyncDiagnostics.js'),
  read('src/components/Admin/Catalog/CatalogLifecycleControls.tsx'),
  read('server/checkout/checkoutReadiness.js'),
]);
const checks = [
  ['Catalog Apply uses structural gate', diagnostics.includes('catalogApplyReady') && backend.includes('catalogApplyReadiness') && backend.includes('applyReadiness.catalogApplyReady')],
  ['Invalid rows stay reviewable', backend.includes("validRows.map((row) => [row.id") && backend.includes("status: applyReadiness.invalidRows > 0 ? 'PARTIALLY_APPLIED' : 'APPLIED'") && !backend.includes("rows.some((row) => row.status === 'INVALID') throw")],
  ['Provider warning does not disable Apply', frontend.includes('Bạn vẫn có thể cập nhật dữ liệu HICO GỐC vào Sản phẩm.') && !frontend.includes('(summary.invalid ?? 0) > 0}')],
  ['Operation warning remains visible', frontend.includes('operationIssueCount') && frontend.includes('chưa xác định operation chắc chắn')],
  ['Checkout provider and operation gates remain', checkout.includes('CANONICAL_OPERATION_UNRESOLVED') && checkout.includes('provider.ready === false') && checkout.includes('ESIM_FULFILLMENT_NOT_READY')],
  ['Apply confirmation states catalog-only scope', frontend.includes('chỉ cập nhật dữ liệu HICO GỐC vào Catalog/Sản phẩm') && frontend.includes('chưa được phép checkout/fulfillment')],
];
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name);
const result = { success: failures.length === 0, checks: checks.length, passed: checks.length - failures.length, failures };
process.stdout.write(`${JSON.stringify(result)}\n`);
if (failures.length) process.exitCode = 1;
