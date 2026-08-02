import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import {
  collectBackupFiles,
  copyFileIfPresent,
  defaultUploadsDirectory,
  parseOption,
  pathForReport,
  readJson,
  sha256File,
  verifyCanonicalBoot,
} from './catalogBackupUtils.js';
import { createOrderRepository } from '../orders/orderRepository.js';
import { createFulfillmentRepository } from '../fulfillment/fulfillmentRepository.js';
import { createManualQrRepository } from '../fulfillment/manualQrRepository.js';
import { createInventoryRepository } from '../fulfillment/inventoryRepository.js';

const defaultBackupRoot = path.join(path.dirname(defaultUploadsDirectory), 'backups', 'checkout-cutover');

const findLatestBackup = async (root) => {
  const entries = await readdir(root, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  if (!directories[0]) throw new Error('No checkout backup found.');
  return path.join(root, directories[0]);
};

const main = async () => {
  const backupDirectory = path.resolve(parseOption('backup-dir', await findLatestBackup(path.resolve(parseOption('backup-root', defaultBackupRoot)))));
  const manifest = await readJson(path.join(backupDirectory, 'backup_manifest.json'));
  if (manifest.noSecrets !== true || !Array.isArray(manifest.files)) throw new Error('Checkout backup manifest is invalid.');
  for (const file of manifest.files) {
    const actual = await sha256File(path.join(backupDirectory, file.name));
    if (actual !== file.checksum) throw new Error(`Backup checksum mismatch for ${file.name}.`);
    await readJson(path.join(backupDirectory, file.name));
  }
  const restoredDirectory = await mkdtemp(path.join(os.tmpdir(), 'hico-checkout-backup-'));
  try {
    for (const relativePath of await collectBackupFiles(backupDirectory)) {
      await copyFileIfPresent({ sourceRoot: backupDirectory, destinationRoot: restoredDirectory, relativePath, required: true });
    }
    const catalogHealth = await verifyCanonicalBoot(restoredDirectory);
    const orderRepository = createOrderRepository({ filePath: path.join(restoredDirectory, 'orders.json') });
    const fulfillmentRepository = createFulfillmentRepository({ filePath: path.join(restoredDirectory, 'fulfillments.json') });
    const qrRepository = createManualQrRepository({ filePath: path.join(restoredDirectory, 'manual_qrs.json') });
    const inventoryRepository = createInventoryRepository({
      inventoryFile: path.join(restoredDirectory, 'inventory.json'),
      movementsFile: path.join(restoredDirectory, 'inventory_movements.json'),
    });
    const [orders, fulfillments, qrs, inventory, movements] = await Promise.all([
      orderRepository.list(), fulfillmentRepository.list(), qrRepository.list(), inventoryRepository.list(), inventoryRepository.listMovements(),
    ]);
    console.log(JSON.stringify({
      verified: true,
      backupDirectory: pathForReport(path.relative(process.cwd(), backupDirectory)),
      canonicalVersionId: catalogHealth.versionId,
      products: catalogHealth.products,
      variants: catalogHealth.variants,
      records: { orders: orders.length, fulfillments: fulfillments.length, manualQrs: qrs.length, inventory: inventory.length, inventoryMovements: movements.length },
      restoreDrill: 'passed',
    }, null, 2));
  } finally {
    await rm(restoredDirectory, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(JSON.stringify({ verified: false, error: 'Checkout backup verification failed.', code: error?.code ?? 'CHECKOUT_BACKUP_VERIFY_FAILED' }));
  process.exitCode = 1;
});
