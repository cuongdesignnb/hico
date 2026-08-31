import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = [path.join(root, 'src', 'adapters'), path.join(root, 'src', 'components'), path.join(root, 'src', 'pages'), path.join(root, 'src', 'hooks'), path.join(root, 'src', 'services')];
const ignored = new Set(['node_modules', 'dist', 'coverage', 'Admin']);
const allowlisted = new Set([path.normalize(path.join(root, 'src', 'services', 'catalogReadApi.ts'))]);
const rules = [
  { code: 'JAPAN_FALLBACK_KEY', pattern: /return\s+['"]jp-esim['"]/g },
  { code: 'JAPAN_COUNTRY_LOOKUP', pattern: /COUNTRIES\s*\[\s*['"]jp-esim['"]\s*\]/g },
  { code: 'FALLBACK_PACKAGE_MAP', pattern: /FALLBACK_PACKAGES_MAP/g },
  { code: 'COUNTRY_FACTORS', pattern: /COUNTRY_FACTORS/g },
  { code: 'DATA_OPTIONS_AS_PRODUCT_SOURCE', pattern: /DATA_OPTIONS/g },
  { code: 'DURATIONS_AS_VARIANT_SOURCE', pattern: /DURATIONS/g },
  { code: 'ADMIN_DESTINATION_API', pattern: /\/api\/admin\/destinations/g },
  { code: 'ADMIN_PACKAGE_API', pattern: /\/api\/admin\/packages/g },
  { code: 'HARDCODED_DEVICE_MAP', pattern: /FALLBACK_DEVICES|device-wifi-(mini|home|5g)|device-usb-4g/g },
  { code: 'JAPAN_MEDIA_FALLBACK', pattern: /dest_japan\.png/g },
];

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) files.push(...await walk(path.join(directory, entry.name)));
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(path.join(directory, entry.name));
  }
  return files;
};

const findings = [];
for (const directory of roots) {
  for (const file of await walk(directory)) {
    if (allowlisted.has(path.normalize(file))) continue;
    const source = await readFile(file, 'utf8');
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(source)) findings.push({ code: rule.code, file: path.relative(root, file).replaceAll('\\', '/'), pattern: rule.pattern.source });
    }
  }
}

if (findings.length > 0) {
  console.error(JSON.stringify({ success: false, findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ success: true, filesChecked: (await Promise.all(roots.map(walk))).flat().length, findings: [] }));
}
