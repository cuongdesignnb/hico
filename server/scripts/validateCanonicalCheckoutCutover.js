import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { atomicWriteJson, defaultUploadsDirectory, readJson } from '../catalog/write/catalogWritePersistence.js';
import { createCanonicalCatalogReader } from '../catalog/canonical/canonicalCatalogReader.js';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { createCatalogHealthService } from '../catalog/health/catalogHealthService.js';
import { createCheckoutIdempotencyRepository } from '../checkout/checkoutIdempotencyRepository.js';
import { validateCanonicalCheckoutStorage, REQUIRED_FULFILLMENT_METHODS } from '../checkout/health/checkoutStartupValidator.js';
import { createFulfillmentService } from '../fulfillment/fulfillmentService.js';
import { createFulfillmentRepository } from '../fulfillment/fulfillmentRepository.js';
import { createFulfillmentIdempotencyRepository } from '../fulfillment/fulfillmentIdempotencyRepository.js';
import { createInventoryRepository } from '../fulfillment/inventoryRepository.js';
import { createManualQrRepository } from '../fulfillment/manualQrRepository.js';
import { createOrderRepository } from '../orders/orderRepository.js';
import { createWebhookReplayRepository, createWebhookEventRepository } from '../webhooks/webhookReplayRepository.js';
import { readCheckoutEngine } from '../checkout/checkoutValidation.js';

const args = (argv) => {
  const values = {};
  for (const value of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(value);
    if (match) values[match[1]] = match[2];
  }
  return values;
};

const isActive = (variant) => variant?.active !== false && variant?.status !== 'archived';
const usable = (variant) => isActive(variant) && variant.needsReview !== true;
const list = (value) => (Array.isArray(value) ? value : Object.values(value ?? {}));

export const buildStrategyReadiness = ({ variants = [], providerOffers = [], manualQrs = [], inventory = [] } = {}) => {
  const activeOffers = providerOffers.filter((offer) => offer.active === true);
  const availableQrs = manualQrs.filter((row) => !row.assignedOrderId && row.qrcode);
  const stockByVariant = new Map(inventory.map((row) => [row.variantId, Number(row.available ?? row.quantity ?? row.stock)]));
  return REQUIRED_FULFILLMENT_METHODS.map((method) => {
    const candidates = list(variants).filter((variant) => usable(variant) && variant.fulfillmentMethod === method);
    const eligible = candidates.filter((variant) => {
      if (method.startsWith('WORLDMOVE_')) return activeOffers.some((offer) => offer.id === variant.providerOfferId || offer.wmproductId === variant.wmproductId);
      if (method === 'HICO_MANUAL_QR') return availableQrs.some((row) => row.variantId === variant.id || row.variantId === variant.variantId);
      if (method === 'HICO_PHYSICAL_STOCK') return Number.isFinite(stockByVariant.get(variant.id)) && stockByVariant.get(variant.id) > 0;
      return true;
    });
    const blockers = [];
    if (candidates.length === 0) blockers.push('NO_ELIGIBLE_VARIANT');
    if (candidates.length > 0 && eligible.length === 0) {
      if (method.startsWith('WORLDMOVE_')) blockers.push('NO_ACTIVE_PROVIDER_OFFER');
      if (method === 'HICO_MANUAL_QR') blockers.push('NO_AVAILABLE_MANUAL_QR');
      if (method === 'HICO_PHYSICAL_STOCK') blockers.push('NO_AVAILABLE_PHYSICAL_INVENTORY');
    }
    return {
      method,
      candidateVariants: candidates.length,
      eligibleVariants: eligible.length,
      ready: eligible.length > 0,
      blockers,
    };
  });
};

const createDependencies = ({ uploadsDirectory, env }) => {
  const canonicalRepository = createCanonicalCatalogRepository({ uploadsDirectory });
  const catalogReader = createCanonicalCatalogReader({ env, canonicalRepository });
  const catalogHealthService = createCatalogHealthService({ env, uploadsDirectory, canonicalRepository });
  const orderRepository = createOrderRepository({ filePath: path.join(uploadsDirectory, 'orders.json') });
  const fulfillmentRepository = createFulfillmentRepository({ filePath: path.join(uploadsDirectory, 'fulfillments.json') });
  const fulfillmentIdempotencyRepository = createFulfillmentIdempotencyRepository({ filePath: path.join(uploadsDirectory, 'fulfillment_idempotency.json') });
  const checkoutIdempotencyRepository = createCheckoutIdempotencyRepository({ filePath: path.join(uploadsDirectory, 'checkout_idempotency.json') });
  const manualQrRepository = createManualQrRepository({ filePath: path.join(uploadsDirectory, 'manual_qrs.json') });
  const inventoryRepository = createInventoryRepository({
    inventoryFile: path.join(uploadsDirectory, 'inventory.json'),
    movementsFile: path.join(uploadsDirectory, 'inventory_movements.json'),
  });
  const webhookReplayRepository = createWebhookReplayRepository({ filePath: path.join(uploadsDirectory, 'webhook_replay.json') });
  const webhookEventRepository = createWebhookEventRepository({ filePath: path.join(uploadsDirectory, 'webhook_events.json') });
  const fulfillmentService = createFulfillmentService({
    repository: fulfillmentRepository,
    idempotencyRepository: fulfillmentIdempotencyRepository,
    orderRepository,
    qrRepository: manualQrRepository,
    inventoryRepository,
  });
  return {
    catalogReader,
    catalogHealthService,
    registry: fulfillmentService.registry,
    orderRepository,
    fulfillmentRepository,
    checkoutIdempotencyRepository,
    fulfillmentIdempotencyRepository,
    webhookReplayRepository,
    webhookEventRepository,
    manualQrRepository,
    inventoryRepository,
  };
};

export const validateCanonicalCheckoutCutover = async ({
  uploadsDirectory = defaultUploadsDirectory,
  reportDirectory = path.join(uploadsDirectory, 'cutover_reports'),
  env = process.env,
} = {}) => {
  const targetEnv = { ...env, CHECKOUT_ENGINE: 'canonical' };
  const dependencies = createDependencies({ uploadsDirectory, env: targetEnv });
  const result = await validateCanonicalCheckoutStorage({
    ...dependencies,
    env: targetEnv,
    providerOffersFile: path.join(uploadsDirectory, 'provider_offers.json'),
  });
  const catalog = await dependencies.catalogReader.readCatalog().catch(() => ({ products: [], variants: [] }));
  const providerOffers = await readJson(path.join(uploadsDirectory, 'provider_offers.json'), []);
  const manualQrs = await dependencies.manualQrRepository.list();
  const inventory = await dependencies.inventoryRepository.list();
  const strategyReadiness = buildStrategyReadiness({ variants: catalog.variants, providerOffers, manualQrs, inventory });
  const strategyBlockers = strategyReadiness
    .filter((item) => !item.ready)
    .flatMap((item) => item.blockers.map((code) => ({
      code: `STRATEGY_${item.method}_${code}`,
      message: 'A valid cutover fixture is not ready for this fulfillment strategy.',
    })));
  const report = {
    reportType: 'canonical-checkout-cutover',
    generatedAt: new Date().toISOString(),
    ready: result.ready && strategyReadiness.every((item) => item.ready),
    currentEngine: (() => { try { return readCheckoutEngine(env); } catch { return 'invalid'; } })(),
    targetEngine: 'canonical',
    catalogVersionId: result.metadata.catalogVersionId ?? null,
    strategyReadiness,
    blockers: [...result.blockers, ...strategyBlockers],
    warnings: result.warnings,
    metadata: result.metadata,
    secretsIncluded: false,
  };
  const reportPath = path.join(reportDirectory, `checkout_cutover_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}.json`);
  await atomicWriteJson(reportPath, report);
  return { report, reportPath };
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const options = args(process.argv.slice(2));
  validateCanonicalCheckoutCutover({
    uploadsDirectory: options['uploads-dir'] ?? defaultUploadsDirectory,
    reportDirectory: options['report-dir'],
  }).then(({ report, reportPath }) => {
    console.log(JSON.stringify({ ready: report.ready, blockerCount: report.blockers.length, reportPath }, null, 2));
    if (!report.ready) process.exitCode = 2;
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
