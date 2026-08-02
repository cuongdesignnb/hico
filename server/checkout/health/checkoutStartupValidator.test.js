import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCanonicalCheckoutStorage, REQUIRED_FULFILLMENT_METHODS } from './checkoutStartupValidator.js';

const repository = (rows = []) => ({
  async list() { return rows; },
  async get() { return null; },
  async create(value) { return value; },
  async update(value) { return value; },
  async save(value) { return value; },
  async has() { return false; },
  async add() { return { fresh: true }; },
  async remove() {},
  async reserve() { return {}; },
  async listMovements() { return []; },
});

const dependencies = ({ orders = [], catalogVariants = [], inventory = [], qrs = [], env: providedEnv } = {}) => ({
  env: providedEnv ?? {
    CHECKOUT_ENGINE: 'canonical',
    CATALOG_READ_SOURCE: 'canonical',
    WORLDMOVE_WEBHOOK_SECRET: 'test-secret',
    WORLDMOVE_WEBHOOK_TOLERANCE_SECONDS: '300',
  },
  catalogHealthService: { async getHealth() { return { status: 'healthy', readSource: 'canonical', versionId: 'v1', products: 1, variants: catalogVariants.length }; } },
  catalogReader: { async readCatalog() { return { products: [{ id: 'p1' }], variants: catalogVariants }; } },
  registry: { list() { return [...REQUIRED_FULFILLMENT_METHODS]; } },
  orderRepository: repository(orders),
  fulfillmentRepository: repository(),
  checkoutIdempotencyRepository: repository(),
  fulfillmentIdempotencyRepository: repository(),
  webhookReplayRepository: repository(),
  webhookEventRepository: repository(),
  manualQrRepository: repository(qrs),
  inventoryRepository: { ...repository(inventory), async listMovements() { return []; } },
});

test('canonical startup validation reports a healthy writable fixture', async () => {
  const result = await validateCanonicalCheckoutStorage({
    ...dependencies({ catalogVariants: [{ id: 'v1', active: true, fulfillmentMethod: 'HICO_PHYSICAL_STOCK' }], inventory: [{ variantId: 'v1', available: 2 }] }),
  });
  assert.equal(result.ready, true);
  assert.equal(result.metadata.physicalInventoryConfigured, true);
  assert.equal(result.metadata.webhookConfigured, true);
});

test('canonical startup validation blocks missing webhook, inventory, and snapshot data', async () => {
  const result = await validateCanonicalCheckoutStorage({
    ...dependencies({
      env: { CHECKOUT_ENGINE: 'canonical', CATALOG_READ_SOURCE: 'canonical' },
      catalogVariants: [{ id: 'v1', active: true, fulfillmentMethod: 'HICO_PHYSICAL_STOCK' }],
      orders: [{ orderId: 'QA-CUTOVER-1', checkoutEngine: 'canonical', status: 'PENDING_SHIP', items: [{}] }],
    }),
  });
  assert.equal(result.ready, false);
  assert.deepEqual(
    result.blockers.map((item) => item.code).sort(),
    ['CANONICAL_ORDER_SNAPSHOT_INVALID', 'PHYSICAL_INVENTORY_NOT_CONFIGURED', 'WEBHOOK_SECURITY_NOT_CONFIGURED'],
  );
});
