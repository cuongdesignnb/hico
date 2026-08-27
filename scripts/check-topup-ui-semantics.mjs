import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];
const assertAbsent = (content, needle, message) => {
  if (content.includes(needle)) failures.push(message);
};

const cart = read('src/components/CartDrawer/CartDrawer.tsx');
const detail = read('src/components/ProductDetail/ProductDetail.tsx');
const account = read('src/pages/account/AccountAssetDetailPage.tsx');
const header = read('src/components/Header/Header.tsx');
const router = read('src/routing/AppRouter.tsx');
const appContext = read('src/context/AppContext.tsx');
const publicPages = read('src/pages/PublicPages.tsx');

for (const needle of ['topupDetails', 'topupDays', 'topupSimAssetId', 'simNum', 'Số ngày top-up', 'Thông tin SIM cần nạp']) {
  assertAbsent(cart, needle, `active cart still contains retired top-up field: ${needle}`);
}
assertAbsent(cart, 'validateCheckout({ ...', 'active cart still builds a top-up checkout payload');
assertAbsent(detail, 'simAssetId', 'product detail still links an active top-up asset');
assertAbsent(detail, 'topupDays', 'product detail still exposes top-up days');
assertAbsent(account, "asset?.assetType === 'TOPUP'", 'account asset detail still offers a top-up CTA');
assertAbsent(account, 'Số ngày top-up', 'account asset detail still exposes top-up days');
assertAbsent(header, '/nap-them', 'public header still exposes a top-up route');
assertAbsent(router, '/nap-them', 'router still exposes an active top-up route');
assertAbsent(publicPages, "operation === 'topup' ? '/nap-them'", 'public catalog still creates a top-up route');
if (!detail.includes('Sản phẩm nạp SIM này đã ngừng mở bán.')) failures.push('product detail does not show the retired-product guard');
if (!appContext.includes("if (record.operation === 'topup') return null;")) failures.push('cart hydration does not reject historical top-up records');
if (!appContext.includes("if (newItem.operation === 'topup')")) failures.push('cart add path does not reject new top-up items');

if (failures.length > 0) {
  console.error(JSON.stringify({ success: false, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ success: true, checks: 16 }));
}
