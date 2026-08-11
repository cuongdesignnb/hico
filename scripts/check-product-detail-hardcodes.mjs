import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'src/pages/ProductDetailPage.tsx',
  'src/components/ProductDetail',
  'src/adapters',
  'src/hooks/catalog',
  'src/services/publicCatalogApi.ts',
  'src/utils/productMedia.ts',
];
const rules = [
  ['COUNTRIES', /\bCOUNTRIES\b/g],
  ['COUNTRY_FACTORS', /\bCOUNTRY_FACTORS\b/g],
  ['DATA_OPTIONS', /\bDATA_OPTIONS\b/g],
  ['DURATIONS', /\bDURATIONS\b/g],
  ['FALLBACK_PACKAGES_MAP', /\bFALLBACK_PACKAGES_MAP\b/g],
  ['getFallbackKey', /\bgetFallbackKey\b/g],
  ['jp-esim', /jp-esim/g],
  ['COUNTRIES_INDEX', /COUNTRIES\s*\[/g],
  ['PUBLIC_ADMIN_DESTINATION_API', /\/api\/admin\/(?:destinations|packages)/g],
  ['JAPAN_MEDIA_FALLBACK', /dest_japan\.png/g],
  ['PRODUCT_FALLBACK_MAP', /FALLBACK_(?:DEVICES|PRODUCTS|VARIANTS|PACKAGES)/g],
];

const walk = async (entry) => {
  const absolute = path.join(root, entry);
  const stats = await import('node:fs/promises').then(({ stat }) => stat(absolute));
  if (stats.isFile()) return [absolute];
  const { readdir } = await import('node:fs/promises');
  const children = await readdir(absolute, { withFileTypes: true });
  return (await Promise.all(children.filter((child) => child.isFile() || !['node_modules', 'dist'].includes(child.name)).map((child) => walk(path.join(entry, child.name))))).flat();
};

const findings = [];
const checked = (await Promise.all(files.map(walk))).flat();
for (const file of checked.filter((file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file))) {
  const source = await readFile(file, 'utf8');
  for (const [code, pattern] of rules) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) findings.push({ code, file: path.relative(root, file).replaceAll('\\', '/') });
  }
}

const result = { success: findings.length === 0, filesChecked: checked.length, findings };
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;
