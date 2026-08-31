import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'node:fs/promises';

const root = process.cwd();
const allowedDataUrlFiles = new Set([
  'src/components/Admin/AdminDashboard.tsx',
  'src/services/adminMediaApi.ts',
]);
const allowedUploadFiles = new Set([
  'src/components/Admin/AdminDashboard.tsx',
  'src/components/Admin/media/MediaLibraryPicker.tsx',
  'src/services/adminMediaApi.ts',
]);
const findings = [];
const add = (file, kind) => findings.push({ file, kind });

for await (const filePath of glob('src/components/Admin/**/*.{ts,tsx}', { cwd: root })) {
  const relativePath = filePath.replaceAll('\\', '/');
  const source = await readFile(path.join(root, filePath), 'utf8');
  if (/<input[^>]+type=["']url["'][^>]*>/i.test(source) && /image|thumbnail|cover|banner|gallery/i.test(source)) add(relativePath, 'image-url-input');
  if (/(?:imageUrl|imageURL|thumbnailUrl|coverUrl|bannerUrl|ogImage)\s*[:=]/.test(source) && /<input|<textarea|placeholder/i.test(source)) add(relativePath, 'free-text-image-url-field');
  if (/readAsDataURL\s*\(/.test(source) && !allowedDataUrlFiles.has(relativePath)) add(relativePath, 'data-url-read');
  if (/\/api\/admin\/media\/upload/.test(source) && !allowedUploadFiles.has(relativePath)) add(relativePath, 'direct-media-upload');
  if (/\/api\/admin\/manual-qrs\/upload/.test(source) && relativePath !== 'src/components/Admin/AdminDashboard.tsx') add(relativePath, 'private-upload-outside-admin');
  if (/https?:\/\/[^'"\s)]+\.(?:jpe?g|png|webp|gif)/i.test(source) && /image|thumbnail|cover|banner|gallery/i.test(source)) add(relativePath, 'hardcoded-external-image');
}

console.log(JSON.stringify({ success: findings.length === 0, findings }, null, 2));
if (findings.length) process.exitCode = 1;
