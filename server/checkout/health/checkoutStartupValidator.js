import path from 'node:path';
import { readJson, defaultUploadsDirectory } from '../../catalog/write/catalogWritePersistence.js';
import { FULFILLMENT_METHODS } from '../../fulfillment/fulfillmentValidation.js';
import { FULFILLMENT_STATES } from '../../fulfillment/fulfillmentStateMachine.js';
import { ORDER_STATUSES } from '../../orders/orderValidation.js';
import { readWebhookConfig } from '../../webhooks/webhookSignature.js';
import { readWorldmoveConfig } from '../../providers/worldmove/worldmoveClient.js';
import { readCheckoutEngine } from '../checkoutValidation.js';

export const CHECKOUT_NOT_READY_CODE = 'CHECKOUT_NOT_READY';
export const REQUIRED_FULFILLMENT_METHODS = Object.freeze([
  'WORLDMOVE_ESIM_REDEEM',
  'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  'HICO_MANUAL_QR',
  'WORLDMOVE_PHYSICAL_ORDER',
  'HICO_PHYSICAL_STOCK',
  'WORLDMOVE_TOPUP',
  'MANUAL_PROCESSING',
]);

const addBlocker = (blockers, code, message = 'Checkout readiness requirement is not satisfied.') => {
  if (!blockers.some((item) => item.code === code)) blockers.push({ code, message });
};

const addWarning = (warnings, code, message) => {
  if (!warnings.some((item) => item.code === code)) warnings.push({ code, message });
};

const isActive = (record) => record?.active !== false && record?.status !== 'archived';
const asList = (value) => (Array.isArray(value) ? value : Object.values(value ?? {}));
const hasText = (value) => typeof value === 'string' && value.trim() !== '';

const checkRepository = async ({ name, repository, readMethod = 'list', writeMethods = [], blockers, metadata }) => {
  if (!repository || typeof repository[readMethod] !== 'function') {
    addBlocker(blockers, `${name.toUpperCase()}_REPOSITORY_UNAVAILABLE`);
    return [];
  }
  for (const method of writeMethods) {
    if (typeof repository[method] !== 'function') addBlocker(blockers, `${name.toUpperCase()}_REPOSITORY_NOT_WRITABLE`);
  }
  try {
    const rows = asList(await repository[readMethod]());
    metadata.repositoryRows[name] = rows.length;
    return rows;
  } catch {
    addBlocker(blockers, `${name.toUpperCase()}_REPOSITORY_UNREADABLE`);
    return [];
  }
};

const snapshotIsComplete = (item) => (
  hasText(item?.productId)
  && hasText(item?.variantId)
  && hasText(item?.sku)
  && hasText(item?.fulfillmentMethod)
  && Number.isInteger(item?.quantity)
  && item.quantity > 0
  && Number.isFinite(item?.unitPrice)
  && hasText(item?.currency)
);

const duplicateValues = (rows, key) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    const value = row?.[key];
    if (!hasText(value)) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates.size;
};

const readProviderOffers = async ({ providerOfferRepository, providerOffersFile }) => {
  if (providerOfferRepository?.listOffers) return asList(await providerOfferRepository.listOffers());
  return asList(await readJson(providerOffersFile, []));
};

export const validateCanonicalCheckoutStorage = async ({
  env = process.env,
  catalogHealthService,
  catalogReader,
  registry,
  orderRepository,
  fulfillmentRepository,
  checkoutIdempotencyRepository,
  fulfillmentIdempotencyRepository,
  webhookReplayRepository,
  webhookEventRepository,
  manualQrRepository,
  inventoryRepository,
  providerOfferRepository,
  providerOffersFile = path.join(defaultUploadsDirectory, 'provider_offers.json'),
  callbackRouteMounted = true,
  bodyLimitConfigured = Number(env.CHECKOUT_BODY_LIMIT_MB ?? 10) > 0 && Number(env.WEBHOOK_BODY_LIMIT_KB ?? 256) > 0,
  rateLimitConfigured = Number(env.CHECKOUT_RATE_LIMIT_PER_MINUTE ?? 120) > 0,
} = {}) => {
  const blockers = [];
  const warnings = [];
  const metadata = {
    repositoryRows: {},
    strategiesRegistered: [],
    activeWorldmoveVariants: 0,
    activeProviderOffers: 0,
    canonicalOrders: 0,
    pendingCanonicalOrders: 0,
  };
  let engine;

  try {
    engine = readCheckoutEngine(env);
  } catch (error) {
    addBlocker(blockers, error.code ?? 'CHECKOUT_ENGINE_INVALID');
    return { ready: false, status: 'unhealthy', engine: null, blockers, warnings, metadata };
  }

  if (engine === 'legacy') {
    return {
      ready: true,
      status: 'healthy',
      engine,
      blockers,
      warnings,
      metadata,
    };
  }

  if ((env.CATALOG_READ_SOURCE ?? 'canonical') !== 'canonical') addBlocker(blockers, 'CATALOG_SOURCE_NOT_CANONICAL');
  const catalogHealth = catalogHealthService ? await catalogHealthService.getHealth() : null;
  if (!catalogHealth || catalogHealth.status !== 'healthy' || catalogHealth.readSource !== 'canonical') {
    addBlocker(blockers, 'CATALOG_NOT_READY');
  }

  let catalog = { products: [], variants: [] };
  try {
    if (!catalogReader?.readCatalog) throw new Error('Catalog reader is unavailable.');
    catalog = await catalogReader.readCatalog();
  } catch {
    addBlocker(blockers, 'CATALOG_REPOSITORY_UNREADABLE');
  }
  const variants = asList(catalog.variants);
  const activeVariants = variants.filter(isActive);
  metadata.activeWorldmoveVariants = activeVariants.filter((variant) => String(variant.fulfillmentMethod ?? '').startsWith('WORLDMOVE_')).length;

  const registered = registry?.list?.() ?? [];
  metadata.strategiesRegistered = [...registered];
  for (const method of REQUIRED_FULFILLMENT_METHODS) {
    if (!registered.includes(method) || !FULFILLMENT_METHODS.has(method)) addBlocker(blockers, 'FULFILLMENT_REGISTRY_INCOMPLETE');
  }

  const orders = await checkRepository({
    name: 'orders', repository: orderRepository, blockers, metadata,
    writeMethods: ['create', 'update'],
  });
  const fulfillments = await checkRepository({
    name: 'fulfillments', repository: fulfillmentRepository, blockers, metadata,
    writeMethods: ['create', 'update'],
  });
  await checkRepository({
    name: 'checkout_idempotency', repository: checkoutIdempotencyRepository, blockers, metadata,
    writeMethods: ['get', 'save'],
  });
  await checkRepository({
    name: 'fulfillment_idempotency', repository: fulfillmentIdempotencyRepository, blockers, metadata,
    writeMethods: ['get', 'save'],
  });
  await checkRepository({
    name: 'webhook_replay', repository: webhookReplayRepository, blockers, metadata,
    writeMethods: ['has', 'add', 'remove'],
  });
  await checkRepository({
    name: 'webhook_events', repository: webhookEventRepository, blockers, metadata,
    writeMethods: ['get', 'save'],
  });
  const qrRows = await checkRepository({
    name: 'manual_qr', repository: manualQrRepository, blockers, metadata,
    writeMethods: ['reserve'],
  });
  const inventoryRows = await checkRepository({
    name: 'inventory', repository: inventoryRepository, blockers, metadata,
    writeMethods: ['reserve'],
  });
  let inventoryMovements = [];
  if (inventoryRepository?.listMovements) {
    try { inventoryMovements = asList(await inventoryRepository.listMovements()); } catch { addBlocker(blockers, 'INVENTORY_REPOSITORY_UNREADABLE'); }
  } else {
    addBlocker(blockers, 'INVENTORY_REPOSITORY_UNAVAILABLE');
  }

  if (duplicateValues(fulfillments, 'id') > 0 || fulfillments.some((row, index) => fulfillments.findIndex((item) => item.orderItemId === row.orderItemId) !== index && hasText(row.orderItemId))) {
    addBlocker(blockers, 'DUPLICATE_FULFILLMENT_RECORD');
  }
  const qrIds = duplicateValues(qrRows, 'id');
  const assignedOrderItems = qrRows.filter((row) => hasText(row.assignedOrderId) && hasText(row.assignedOrderItemId));
  if (qrIds > 0 || duplicateValues(assignedOrderItems, 'assignedOrderItemId') > 0) addBlocker(blockers, 'DUPLICATE_QR_ASSIGNMENT');
  if (inventoryRows.some((row) => Number(row.available ?? row.quantity ?? row.stock) < 0) || inventoryMovements.some((row) => Number(row.quantity) < 0)) addBlocker(blockers, 'NEGATIVE_INVENTORY');

  for (const order of orders) {
    if (!ORDER_STATUSES.has(order.status)) addBlocker(blockers, 'UNSUPPORTED_ORDER_STATUS');
    if (order.checkoutEngine === 'canonical') {
      metadata.canonicalOrders += 1;
      const complete = Array.isArray(order.items) && order.items.every(snapshotIsComplete);
      if (!complete) addBlocker(blockers, 'CANONICAL_ORDER_SNAPSHOT_INVALID');
      if (['PENDING_CALLBACK', 'PENDING_QR_ASSIGN', 'PENDING_SHIP'].includes(order.status)) metadata.pendingCanonicalOrders += 1;
    }
  }
  for (const record of fulfillments) if (!FULFILLMENT_STATES.has(record.state)) addBlocker(blockers, 'UNSUPPORTED_FULFILLMENT_STATUS');

  const webhookConfig = readWebhookConfig(env);
  if (!hasText(webhookConfig.secret) || !Number.isFinite(webhookConfig.toleranceSeconds) || webhookConfig.toleranceSeconds <= 0) addBlocker(blockers, 'WEBHOOK_SECURITY_NOT_CONFIGURED');
  if (!callbackRouteMounted) addBlocker(blockers, 'CALLBACK_ROUTE_NOT_MOUNTED');
  if (!bodyLimitConfigured) addBlocker(blockers, 'BODY_LIMIT_NOT_CONFIGURED');
  if (!rateLimitConfigured) addBlocker(blockers, 'RATE_LIMIT_NOT_CONFIGURED');

  if (metadata.activeWorldmoveVariants > 0) {
    try { readWorldmoveConfig(env); } catch { addBlocker(blockers, 'WORLDMOVE_PROVIDER_NOT_CONFIGURED'); }
    try {
      const offers = await readProviderOffers({ providerOfferRepository, providerOffersFile });
      metadata.activeProviderOffers = offers.filter((offer) => offer.active === true).length;
      if (metadata.activeProviderOffers === 0) addBlocker(blockers, 'ACTIVE_PROVIDER_OFFER_MISSING');
    } catch {
      addBlocker(blockers, 'PROVIDER_OFFERS_UNREADABLE');
    }
  } else {
    addWarning(warnings, 'NO_ACTIVE_WORLDMOVE_VARIANT', 'No active Worldmove variant is currently available.');
  }

  const activePhysicalStock = activeVariants.filter((variant) => variant.fulfillmentMethod === 'HICO_PHYSICAL_STOCK');
  if (activePhysicalStock.length > 0 && inventoryRows.length === 0) addBlocker(blockers, 'PHYSICAL_INVENTORY_NOT_CONFIGURED');
  const activeManualQr = activeVariants.filter((variant) => variant.fulfillmentMethod === 'HICO_MANUAL_QR');
  if (activeManualQr.length > 0 && !qrRows.some((row) => !row.assignedOrderId && hasText(row.qrcode))) addBlocker(blockers, 'MANUAL_QR_INVENTORY_NOT_CONFIGURED');

  return {
    ready: blockers.length === 0,
    status: blockers.length === 0 ? 'healthy' : 'unhealthy',
    engine,
    blockers,
    warnings,
    metadata: {
      ...metadata,
      catalogVersionId: catalogHealth?.versionId ?? null,
      catalogProducts: Number(catalogHealth?.products ?? asList(catalog.products).length),
      catalogVariants: Number(catalogHealth?.variants ?? variants.length),
      webhookConfigured: hasText(webhookConfig.secret),
      physicalInventoryConfigured: inventoryRows.length > 0,
      manualQrConfigured: qrRows.some((row) => !row.assignedOrderId && hasText(row.qrcode)),
    },
  };
};
