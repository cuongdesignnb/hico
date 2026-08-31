import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'server', 'docs/customer', 'docs/agent', 'public', 'nginx.conf', 'docker-compose.yml'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.md', '.json', '.yml', '.yaml', '.conf', '.txt']);
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', 'backups', 'uploads', '.git']);
const mojibakePatterns = [
  '\u00c3\u0192', '\u00c3\u201a', '\u00c3\u2020', '\u00c3\u00a1\u00c2\u00ba', '\u00c3\u00a1\u00c2\u00bb',
  '\u00c3\u00a2\u00e2\u201a\xac', '\u00c3\u00b0\u00c5\u00b8', '\u00ef\u00bf\u00bd', '\uFFFD',
].map((value) => JSON.parse(`"${value}"`));
const allowlistedFixtureSuffixes = new Set([
  path.normalize('server/fixtures/encoding-mojibake.fixture.txt'),
]);
const findings = [];

const filesUnder = (entry) => {
  const absolute = path.resolve(entry);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [absolute];
  const files = [];
  for (const item of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (item.isDirectory() && ignoredDirectories.has(item.name)) continue;
    files.push(...filesUnder(path.join(absolute, item.name)));
  }
  return files;
};

for (const entry of roots.flatMap(filesUnder)) {
  if (path.extname(entry) && !extensions.has(path.extname(entry).toLowerCase())) continue;
  const relative = path.normalize(path.relative(process.cwd(), entry));
  if (allowlistedFixtureSuffixes.has(relative)) continue;
  const bytes = fs.readFileSync(entry);
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) findings.push(`${relative}: unexpected UTF-8 BOM`);
  let content;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    findings.push(`${relative}: invalid UTF-8`);
    continue;
  }
  for (const pattern of mojibakePatterns) if (content.includes(pattern)) findings.push(`${relative}: forbidden encoding marker ${JSON.stringify(pattern)}`);
  if (content.normalize('NFC') !== content) findings.push(`${relative}: content is not NFC-normalized`);
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Vietnamese encoding check passed (${roots.length} roots, UTF-8/NFC, no mojibake markers).`);
}
