import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  assertArrayFile,
  collectBackupFiles,
  copyFileIfPresent,
  defaultBackupRoot,
  defaultUploadsDirectory,
  parseOption,
  pathForReport,
  readJson,
  sha256File,
  timestampLabel,
} from './catalogBackupUtils.js';
import { validateCanonicalCatalogStorage } from '../catalog/health/catalogStartupValidator.js';

const uploadsDirectory = path.resolve(parseOption('uploads-dir', defaultUploadsDirectory));
const backupRoot = path.resolve(parseOption('output-root', defaultBackupRoot));
const backupDirectory = path.join(backupRoot, timestampLabel());

const optionalFiles = [
  'catalog_products.json',
  'catalog_variants.json',
  'catalog_audit.json',
  'catalog_idempotency.json',
  'catalog_slug_history.json',
  'catalog_reconciliation.json',
  'provider_offers.json',
  'manual_qrs.json',
  'devices.json',
  'esims.json',
];

const main = async () => {
  const health = await validateCanonicalCatalogStorage({ uploadsDirectory });
  await assertArrayFile(uploadsDirectory, 'destinations.json');
  await assertArrayFile(uploadsDirectory, 'packages.json');
  const pointer = await readJson(path.join(uploadsDirectory, 'catalog_current.json'));
  const versionId = pointer.versionId ?? pointer.migrationId;
  await mkdir(backupRoot, { recursive: true });
  await mkdir(backupDirectory);

  const copied = [];
  for (const relativePath of [
    'catalog_current.json',
    'destinations.json',
    'packages.json',
    ...optionalFiles,
  ]) {
    const result = await copyFileIfPresent({
      sourceRoot: uploadsDirectory,
      destinationRoot: backupDirectory,
      relativePath,
    });
    if (result) copied.push(result);
  }
  const versionFiles = await collectBackupFiles(path.join(uploadsDirectory, 'catalog_versions', versionId));
  for (const relativePath of versionFiles) {
    const versionRelativePath = path.join('catalog_versions', versionId, relativePath);
    const result = await copyFileIfPresent({
      sourceRoot: uploadsDirectory,
      destinationRoot: backupDirectory,
      relativePath: versionRelativePath,
      required: true,
    });
    if (result) copied.push(result);
  }

  const files = [];
  for (const relativePath of copied.sort()) {
    files.push({
      name: pathForReport(relativePath),
      checksum: await sha256File(path.join(backupDirectory, relativePath)),
    });
  }
  const manifest = {
    createdAt: new Date().toISOString(),
    canonicalVersionId: health.versionId,
    schemaVersion: health.schemaVersion,
    files,
  };
  await writeFile(
    path.join(backupDirectory, 'backup_manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify({
    backupDirectory: pathForReport(path.relative(process.cwd(), backupDirectory)),
    canonicalVersionId: health.versionId,
    files: files.length,
  }, null, 2));
};

main().catch((error) => {
  console.error(JSON.stringify({
    error: 'Không thể tạo backup catalog.',
    code: error?.code ?? 'CATALOG_BACKUP_FAILED',
  }));
  process.exitCode = 1;
});
