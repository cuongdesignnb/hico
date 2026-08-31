import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('src/components/Admin/Settings/Integrations/GoogleSheetCredentialGuide.tsx');
const content = fs.readFileSync(file, 'utf8');
const required = [
  'Tạo hoặc chọn Google Cloud Project',
  'Bật Google Sheets API',
  'Tạo Service Account',
  'Tạo và tải khóa JSON',
  'Chia sẻ Google Sheet cho Service Account',
  'Lấy Spreadsheet ID',
  'Xác định tên Sheet và Range',
  'Cài đặt trong HICO',
  'Kiểm tra kết nối',
  'GOOGLE_SHEET_PERMISSION_DENIED',
  'Viewer',
  'noopener noreferrer',
];
const forbidden = [
  '-----BEGIN',
  'access_token:',
  'client_secret:',
  'localStorage',
  'sessionStorage',
  'fetch(',
  'credentialText',
  'googleSheetSettingsApi',
];
const findings = [];
if (content.charCodeAt(0) === 0xfeff) findings.push('guide has an unexpected UTF-8 BOM');
if (content.normalize('NFC') !== content) findings.push('guide is not NFC-normalized');
for (const phrase of required) if (!content.includes(phrase)) findings.push(`guide is missing required copy: ${phrase}`);
for (const phrase of forbidden) if (content.includes(phrase)) findings.push(`guide contains forbidden content: ${phrase}`);
if (/https?:\/\/[^'"\s]+\?[^'"\s]*(credential|token|secret|key)/i.test(content)) findings.push('guide contains a secret-bearing external URL');

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Google Sheet credential guide check passed (9 steps, safe links, no credential state or secret-bearing URL).');
}
