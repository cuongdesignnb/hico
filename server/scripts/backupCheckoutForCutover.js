import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  collectBackupFiles,
  copyFileIfPresent,
  defaultUploadsDirectory,
  parseOption,
  pathForReport,
  readJson,
  sha256File,
  timestampLabel,
} from './catalogBackupUtils.js';
import { validateCanonicalCatalogStorage } from '../catalog/health/catalogStartupValidator.js';

const defaultBackupRoot = path.join(path.dirname(defaultUploadsDirectory), 'backups', 'checkout-cutover');
const uploadsDirectory = path.resolve(parseOption('uploads-dir', defaultUploadsDirectory));
const backupRoot = path.resolve(parseOption('output-root', defaultBackupRoot));
const backupDirectory = path.join(backupRoot, timestampLabel());

const runtimeFiles = [
  'orders.json',
  'fulfillments.json',
  'checkout_idempotency.json',
  'fulfillment_idempotency.json',
  'webhook_events.json',
  'webhook_replay.json',
  'manual_qrs.json',
  'inventory.json',
  'inventory_movements.json',
  'provider_offers.json',
];

const main = async () => {
  const catalogHealth = await validateCanonicalCatalogStorage({ uploadsDirectory });
  const pointer = await readJson(path.join(uploadsDirectory, 'catalog_current.json'));
  const versionId = pointer.versionId ?? pointer.migrationId;
  if (!versionId) throw new Error('Canonical catalog version is missing.');
  await mkdir(backupDirectory, { recursive: true });

  const copied = [];
  for (const relativePath of ['catalog_current.json', ...runtimeFiles]) {
    const result = await copyFileIfPresent({
      sourceRoot: uploadsDirectory,
      destinationRoot: backupDirectory,
      relativePath,
      required: relativePath === 'orders.json',
    });
    if (result) copied.push(result);
  }
  const versionRoot = path.join(uploadsDirectory, 'catalog_versions', versionId);
  for (const relativePath of await collectBackupFiles(versionRoot)) {
    const versionRelativePath = path.join('catalog_versions', versionId, relativePath);
    copied.push(await copyFileIfPresent({
      sourceRoot: uploadsDirectory,
      destinationRoot: backupDirectory,
      relativePath: versionRelativePath,
      required: true,
    }));
  }

  const configSnapshot = {
    checkoutEngine: process.env.CHECKOUT_ENGINE ?? 'canonical',
    catalogReadSource: process.env.CATALOG_READ_SOURCE ?? 'canonical',
    catalogVersionId: catalogHealth.versionId ?? versionId,
    webhookConfigured: Boolean(process.env.WORLDMOVE_WEBHOOK_SECRET),
    secretsIncluded: false,
  };
  await writeFile(path.join(backupDirectory, 'config_snapshot.json'), `${JSON.stringify(configSnapshot, null, 2)}\n`, 'utf8');
  copied.push('config_snapshot.json');

  const files = await Promise.all(copied.filter(Boolean).sort().map(async (name) => ({
    name: pathForReport(name),
    checksum: await sha256File(path.join(backupDirectory, name)),
  })));
  const manifest = {
    backupType: 'checkout-cutover',
    createdAt: new Date().toISOString(),
    canonicalVersionId: catalogHealth.versionId ?? versionId,
    checkoutEngine: configSnapshot.checkoutEngine,
    noSecrets: true,
    files,
  };
  await writeFile(path.join(backupDirectory, 'backup_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    backupDirectory: pathForReport(path.relative(process.cwd(), backupDirectory)),
    canonicalVersionId: manifest.canonicalVersionId,
    files: files.length,
    noSecrets: true,
  }, null, 2));
};

main().catch((error) => {
  console.error(JSON.stringify({ error: 'Checkout backup failed.', code: error?.code ?? 'CHECKOUT_BACKUP_FAILED' }));
  process.exitCode = 1;
});
