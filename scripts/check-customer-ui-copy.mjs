import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/components/Account', 'src/pages/account', 'src/pages/customerAuth'];
const noAccentPhrases = [
  'Tong quan', 'Don hang', 'Diem thuong', 'Gioi thieu', 'Thong bao', 'Ho so', 'Dia chi', 'Bao mat', 'Ho tro',
  'Dang nhap', 'Dang ky', 'Quen mat khau', 'Mat khau', 'Tai khoan', 'Xem chi tiet', 'Thu lai', 'Khong co du lieu',
  'Dang xu ly', 'Da hoan tat', 'Chua co', 'Khong the', 'Tao yeu cau', 'Gui yeu cau', 'Lich su', 'Trang thai',
];
const files = [];
const collect = (root) => {
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, item.name);
    if (item.isDirectory()) collect(file);
    else if (/\.(tsx?|jsx?)$/.test(item.name)) files.push(file);
  }
};
roots.forEach(collect);
const findings = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (/UserDashboard|\/api\/user\//.test(content)) findings.push(`${file}: legacy customer dashboard/API reference`);
  for (const phrase of noAccentPhrases) if (content.includes(phrase)) findings.push(`${file}: review no-diacritic UI phrase "${phrase}"`);
  if (/demo customer|mock customer|mock dashboard/i.test(content)) findings.push(`${file}: private UI contains demo/mock customer copy`);
}
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Customer UI copy check passed (${files.length} source files reviewed).`);
}
