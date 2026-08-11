import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = [
  'server/integrations/googleSheets',
  'server/catalog/sheetSync',
  'src/components/Admin/Settings/Integrations',
  'src/components/Admin/CatalogSheetSync',
];
const forbidden = [
  /google\.drive\s*\(/i,
  /drive\.files\.(?:list|get)/i,
  /auth\/drive(?:\.readonly|\.metadata\.readonly)?/i,
  /drive\.readonly/i,
  /drive\.metadata\.readonly/i,
];
const files = targets.flatMap((target) => {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return [];
  const stack = [absolute];
  const result = [];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) stack.push(...fs.readdirSync(current).map((entry) => path.join(current, entry)));
    else if (/\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(current)) result.push(current);
  }
  return result;
});
const violations = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (forbidden.some((pattern) => pattern.test(line))) violations.push(`${path.relative(root, file)}:${index + 1}`);
  });
}
if (violations.length) {
  console.error(`Google Sheet integration contains forbidden Drive references:\n${violations.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Google Sheet integration no-Drive check passed (${files.length} files scanned).`);
}
