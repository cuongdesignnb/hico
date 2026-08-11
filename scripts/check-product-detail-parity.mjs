import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewPath = path.join(root, 'src', 'components', 'ProductDetail', 'ProductDetail.tsx');
const cssPath = path.join(root, 'src', 'components', 'ProductDetail', 'ProductDetail.css');
const [view, css] = await Promise.all([readFile(viewPath, 'utf8'), readFile(cssPath, 'utf8')]);

const requiredViewSections = [
  'product-detail-page',
  'product-main-grid',
  'product-gallery-col',
  'product-info-col',
  'product-checkout-col',
  'quick-benefits-strip',
  'product-tabs-container',
  'reviews-tab-container',
  'faq',
];
const requiredCssSections = [
  '.product-detail-page',
  '.product-main-grid',
  '.gallery-main-box',
  '.package-card-option',
  '.checkout-card-box',
  '.product-tabs-container',
  '.reviews-tab-container',
  '@media (max-width: 600px)',
];
const forbiddenPatterns = [
  /COUNTRIES/g,
  /COUNTRY_FACTORS/g,
  /DATA_OPTIONS/g,
  /FALLBACK_PACKAGES_MAP/g,
  /getFallbackKey/g,
  /\/api\/admin\//g,
  /dest_japan\.png/g,
];

const missing = [
  ...requiredViewSections.filter((value) => !view.includes(value)).map((value) => `view:${value}`),
  ...requiredCssSections.filter((value) => !css.includes(value)).map((value) => `css:${value}`),
];
const forbidden = forbiddenPatterns.filter((pattern) => pattern.test(view)).map((pattern) => pattern.source);

if (missing.length || forbidden.length) {
  console.error(JSON.stringify({ success: false, missing, forbidden }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ success: true, baseline: '78a8a8f', missing: [], forbidden: [] }));
}
