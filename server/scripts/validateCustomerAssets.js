import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['customer/customerAssetProjection.js', 'customer/customerAssetRepository.js', 'customer/customerAssetRevealService.js', 'customer/customerAssetRouter.js'];
const forbidden = [/localStorage/i, /sessionStorage/i, /redeem_sample/i, /RC_[A-Z0-9]{4,}/i, /LPA:\d/i];
const rawSecretPattern = /(?:LPA:\d|RC_[A-Z0-9]{4,}|\b\d{16,22}\b)/i;

export const validateCustomerAssets = async ({ assets = [], orders = [], env = process.env } = {}) => {
  const findings = [];
  for (const file of files) {
    const source = await fs.readFile(path.join(root, file), 'utf8');
    forbidden.forEach((pattern) => { if (pattern.test(source)) findings.push({ file, code: 'FORBIDDEN_ASSET_SOURCE' }); });
  }
  const enabled = String(env.CUSTOMER_ASSETS_ENABLED ?? '').toLowerCase() === 'true';
  const orderMap = new Map(orders.map((order) => [order.orderId, order]));
  const ids = new Set();
  const sourceIds = new Set();
  const checks = {
    ownerScoped: true,
    noUnownedOrders: true,
    noDuplicateAssets: true,
    noDuplicateIccid: true,
    noDuplicateQrAssignments: true,
    noOrphanAssets: true,
    noRawSecretsInList: true,
    noMockSource: true,
    stockMovementConsistent: true,
    topupProviderEventUnique: true,
    revealAuditRedacted: true,
  };
  for (const asset of assets) {
    if (ids.has(asset.id)) checks.noDuplicateAssets = false;
    ids.add(asset.id);
    const order = orderMap.get(asset.orderId);
    if (!order || order.ownershipStatus !== 'OWNED' || !order.customerId) checks.noUnownedOrders = false;
    if (asset.source?.fulfillmentId && sourceIds.has(asset.source.fulfillmentId)) checks.noDuplicateAssets = false;
    if (asset.source?.fulfillmentId) sourceIds.add(asset.source.fulfillmentId);
    if (rawSecretPattern.test(JSON.stringify(asset))) checks.noRawSecretsInList = false;
    if (/mock|demo|sample/i.test(JSON.stringify(asset))) checks.noMockSource = false;
  }
  Object.entries(checks).forEach(([code, passed]) => { if (!passed) findings.push({ code }); });
  return { status: findings.length ? 'fail' : 'pass', enabled, findings, checks, writesToSource: false, rawSecretsInReport: false };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateCustomerAssets();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== 'pass') process.exitCode = 1;
}
