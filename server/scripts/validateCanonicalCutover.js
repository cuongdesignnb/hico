import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { adaptCanonicalToLegacy } from '../catalog/legacy/legacyCatalogAdapter.js';
import { createLegacyCatalogParity } from '../catalog/legacy/legacyCatalogParity.js';
import { createCatalogRepository } from '../catalog/catalogRepository.js';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { createCatalogHealthService } from '../catalog/health/catalogHealthService.js';
import { createCatalogQueueService } from '../catalog/queues/catalogQueueService.js';
import { createProviderOfferRepository } from '../providers/providerOfferRepository.js';
import { createReconciliationRepository } from '../catalog/reconciliation/reconciliationRepository.js';
import { atomicWriteJson, defaultUploadsDirectory, readJson } from '../catalog/write/catalogWritePersistence.js';
import { parseOption, timestampLabel } from './catalogBackupUtils.js';

const uploadsDirectory = path.resolve(parseOption('uploads-dir', defaultUploadsDirectory));
const reportDirectory = path.join(uploadsDirectory, 'cutover_reports');

const readArray = async (name, fallback = []) => readJson(path.join(uploadsDirectory, name), fallback);

const queueTotal = async (service, method) => (await service[method]({ limit: 1 })).total;

const main = async () => {
  const env = {
    ...process.env,
    CATALOG_READ_SOURCE: 'canonical',
    CATALOG_CANONICAL_FALLBACK: 'false',
  };
  const healthService = createCatalogHealthService({
    env,
    uploadsDirectory,
    logger: { info() {}, error() {} },
  });
  const catalogHealth = await healthService.validate({ force: true });
  const blockers = [];
  const warnings = [];
  if (catalogHealth.status !== 'healthy') blockers.push(catalogHealth.failureCode ?? 'CATALOG_NOT_READY');

  const canonicalRepository = createCanonicalCatalogRepository({ uploadsDirectory });
  const legacyRepository = createCatalogRepository({ uploadsDirectory });
  let canonical = { products: [], variants: [] };
  let legacy = { destinations: [], packages: [] };
  let parity = { success: false };
  if (catalogHealth.status === 'healthy') {
    canonical = await canonicalRepository.readCatalog({ required: true });
    legacy = await legacyRepository.readLegacyCatalog();
    const adapted = adaptCanonicalToLegacy(canonical);
    parity = createLegacyCatalogParity({
      legacy,
      adapted,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    if (!parity.success) blockers.push('LEGACY_PARITY_FAILED');
  }

  const reconciliation = await readJson(path.join(uploadsDirectory, 'catalog_reconciliation.json'), []);
  const providerOffers = await createProviderOfferRepository({
    offersFile: path.join(uploadsDirectory, 'provider_offers.json'),
  }).listOffers();
  const manualQrs = await readArray('manual_qrs.json');
  const variantIds = new Set(canonical.variants.map((variant) => variant.id));
  const inventory = {
    manualQrCount: manualQrs.length,
    orphanManualQrCount: manualQrs.filter((qr) => !variantIds.has(qr.variantId)).length,
    physicalStockVariantCount: canonical.variants.filter((variant) => variant.fulfillmentMethod === 'HICO_PHYSICAL_STOCK').length,
    invalidStockCount: canonical.variants.filter((variant) => variant.stock !== null && variant.stock !== undefined && (!Number.isInteger(variant.stock) || variant.stock < 0)).length,
  };
  if (inventory.orphanManualQrCount > 0) warnings.push('ORPHAN_MANUAL_QR');
  if (inventory.invalidStockCount > 0) warnings.push('INVALID_STOCK');

  const queueService = createCatalogQueueService({ uploadsDirectory });
  const publishQueues = {
    skuConflicts: await queueTotal(queueService, 'listSkuConflicts'),
    needsReview: await queueTotal(queueService, 'listNeedsReview'),
    providerIssues: await queueTotal(queueService, 'listProviderIssues'),
    inventoryWarnings: await queueTotal(queueService, 'listInventoryWarnings'),
  };
  const report = {
    ready: blockers.length === 0,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    canonicalVersionId: catalogHealth.versionId,
    catalogHealth: {
      status: catalogHealth.status,
      readSource: catalogHealth.readSource,
      versionId: catalogHealth.versionId,
      products: catalogHealth.products,
      variants: catalogHealth.variants,
      checksumValid: catalogHealth.checksumValid,
      schemaVersion: catalogHealth.schemaVersion,
      legacyRollbackAvailable: catalogHealth.legacyRollbackAvailable,
    },
    legacyParity: {
      success: parity.success,
      legacyDestinations: parity.legacyDestinations ?? legacy.destinations.length,
      adaptedDestinations: parity.adaptedDestinations ?? 0,
      legacyPackages: parity.legacyPackages ?? legacy.packages.length,
      adaptedPackages: parity.adaptedPackages ?? 0,
      missingDestinationIds: parity.missingDestinationIds?.length ?? 0,
      extraDestinationIds: parity.extraDestinationIds?.length ?? 0,
      missingPackageIds: parity.missingPackageIds?.length ?? 0,
      extraPackageIds: parity.extraPackageIds?.length ?? 0,
      changedProductFields: parity.changedProductFields?.length ?? 0,
      changedVariantFields: parity.changedVariantFields?.length ?? 0,
    },
    reconciliation: {
      total: reconciliation.length,
      needsReview: reconciliation.filter((record) => record.status !== 'MATCHED').length,
    },
    providerOffers: {
      total: providerOffers.length,
      active: providerOffers.filter((offer) => offer.active).length,
      inactive: providerOffers.filter((offer) => !offer.active).length,
    },
    inventory,
    publishQueues,
    bulkPreviewDryRun: {
      available: true,
      entityType: 'variant',
      matchedCount: canonical.variants.length,
      writePerformed: false,
    },
    canonicalWriteSmokeDryRun: {
      available: true,
      writePerformed: false,
    },
  };
  await mkdir(reportDirectory, { recursive: true });
  const reportFile = path.join(reportDirectory, `canonical_cutover_${timestampLabel()}.json`);
  await atomicWriteJson(reportFile, report);
  console.log(JSON.stringify({ reportFile: path.relative(process.cwd(), reportFile), ...report }, null, 2));
  if (!report.ready) process.exitCode = 1;
};

main().catch((error) => {
  console.error(JSON.stringify({
    ready: false,
    error: 'Không thể tạo cutover report.',
    code: error?.code ?? 'CANONICAL_CUTOVER_VALIDATION_FAILED',
  }));
  process.exitCode = 1;
});
