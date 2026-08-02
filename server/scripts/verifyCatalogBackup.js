import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import {
  collectBackupFiles,
  copyFileIfPresent,
  defaultBackupRoot,
  parseOption,
  pathForReport,
  readJson,
  sha256File,
  verifyCanonicalBoot,
} from './catalogBackupUtils.js';
import { assertArrayFile } from './catalogBackupUtils.js';

const findLatestBackup = async () => {
  const root = path.resolve(parseOption('backup-root', defaultBackupRoot));
  const entries = await (await import('node:fs/promises')).readdir(root, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  if (!directories[0]) throw new Error('No catalog backup found.');
  return path.join(root, directories[0]);
};

const main = async () => {
  const backupDirectory = path.resolve(parseOption('backup-dir', await findLatestBackup()));
  const manifest = await readJson(path.join(backupDirectory, 'backup_manifest.json'));
  if (!Array.isArray(manifest.files)) throw new Error('Backup manifest files are invalid.');
  for (const file of manifest.files) {
    const actual = await sha256File(path.join(backupDirectory, file.name));
    if (actual !== file.checksum) throw new Error(`Backup checksum mismatch for ${file.name}.`);
  }
  await assertArrayFile(backupDirectory, 'destinations.json');
  await assertArrayFile(backupDirectory, 'packages.json');
  const restoredDirectory = await mkdtemp(path.join(os.tmpdir(), 'hico-catalog-backup-'));
  try {
    for (const relativePath of await collectBackupFiles(backupDirectory)) {
      await copyFileIfPresent({
        sourceRoot: backupDirectory,
        destinationRoot: restoredDirectory,
        relativePath,
        required: true,
      });
    }
    const health = await verifyCanonicalBoot(restoredDirectory);
    console.log(JSON.stringify({
      verified: true,
      backupDirectory: pathForReport(path.relative(process.cwd(), backupDirectory)),
      canonicalVersionId: health.versionId,
      products: health.products,
      variants: health.variants,
      restoreDrill: 'passed',
    }, null, 2));
  } finally {
    await rm(restoredDirectory, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(JSON.stringify({
    verified: false,
    error: 'Backup verification failed.',
    code: error?.code ?? 'CATALOG_BACKUP_VERIFY_FAILED',
  }));
  process.exitCode = 1;
});
