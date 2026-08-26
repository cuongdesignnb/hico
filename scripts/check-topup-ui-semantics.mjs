import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];
const cart = read('src/components/CartDrawer/CartDrawer.tsx');
const detail = read('src/components/ProductDetail/ProductDetail.tsx');
const account = read('src/pages/account/AccountAssetDetailPage.tsx');
const labels = read('src/utils/cartItemClassification.ts');

if (!labels.includes('if (operation === \'topup\') return \'Nạp SIM\';')) failures.push('purchase label is not operation-aware for top-up');
if (!labels.includes("if (operation === 'topup') return 'Dùng cho SIM hiện có';")) failures.push('fulfillment label is not operation-aware for top-up');
if (!cart.includes('requiresTopupForCartItem(item) ? <span className="quantity-val">Số lượng: 1</span>')) failures.push('cart does not lock top-up quantity to one');
if (!cart.includes('Không giao hàng')) failures.push('cart does not state that top-up is not shipped');
if (!detail.includes("const simTypes = displayProduct.operation === 'topup' ? []")) failures.push('product detail still exposes SIM type selector for top-up');
if (!detail.includes("const effectiveQuantity = displayProduct.operation === 'topup' ? 1")) failures.push('product detail does not force top-up quantity to one');
if (!detail.includes('purchaseOptions.length <= 1 && displayProduct.familyProducts')) failures.push('redundant family selector is not hidden when purchase options are plural');
if (detail.includes("familyProduct.medium === 'physical_sim' ? 'SIM vật lý'")) failures.push('family product label still derives from medium only');
if (!account.includes("asset?.assetType === 'TOPUP'")) failures.push('physical asset can still guess a top-up CTA');
if (account.includes("['TOPUP', 'PHYSICAL_SIM'].includes(asset.assetType)")) failures.push('physical asset CTA allowlist remains');

if (failures.length > 0) {
  console.error(JSON.stringify({ success: false, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ success: true, checks: 10 }));
}
