import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { createPostgresOrderRepository } from '../orders/postgresOrderRepository.js';
import { createFulfillmentRepository } from '../fulfillment/fulfillmentRepository.js';
import { createCustomerAssetRepository } from '../customer/customerAssetRepository.js';
import { isMockAssetSource } from '../customer/customerAssetProjection.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(directory, '../uploads/migration_reports');
const now = () => new Date();

const emptyReport = (status, reason = null) => ({
  reportType: 'customer-assets-backfill',
  mode: 'dry-run',
  dryRun: true,
  generatedAt: now().toISOString(),
  status,
  reason,
  writesToSource: false,
  ordersScanned: 0,
  ownedOrders: 0,
  legacyUnresolved: 0,
  guestUnclaimed: 0,
  fulfillmentRecordsScanned: 0,
  projectedAssets: 0,
  assetsCreated: { esim: 0, physicalSim: 0, device: 0, topup: 0 },
  assetsUnchanged: 0,
  skippedUnownedOrders: 0,
  missingFulfillment: 0,
  skippedMockRecords: 0,
  conflicts: [],
  assetsByType: { ESIM: 0, PHYSICAL_SIM: 0, DEVICE: 0, TOPUP: 0 },
  unresolved: [],
});

export const backfillCustomerAssets = async ({ pool, orderRepository, fulfillmentRepository, env = process.env } = {}) => {
  let ownPool = false;
  let activePool = pool;
  try {
    const db = activePool ?? createPostgresPool({ env });
    activePool = db;
    ownPool = !pool;
    const ordersResult = await db.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE ownership_status = \'OWNED\')::int AS owned, COUNT(*) FILTER (WHERE ownership_status = \'LEGACY_UNRESOLVED\')::int AS legacy_unresolved, COUNT(*) FILTER (WHERE ownership_status = \'GUEST_UNCLAIMED\')::int AS guest_unclaimed FROM orders');
    const customerIds = (await db.query('SELECT id FROM customers ORDER BY id')).rows.map((row) => row.id);
    const fulfillment = fulfillmentRepository ?? createFulfillmentRepository();
    const repository = orderRepository ?? createPostgresOrderRepository({ pool: db });
    const report = emptyReport('complete');
    const counts = ordersResult.rows[0] ?? {};
    report.ordersScanned = Number(counts.total ?? 0);
    report.ownedOrders = Number(counts.owned ?? 0);
    report.legacyUnresolved = Number(counts.legacy_unresolved ?? 0);
    report.guestUnclaimed = Number(counts.guest_unclaimed ?? 0);
    report.skippedUnownedOrders = Math.max(0, report.ordersScanned - report.ownedOrders);
    const records = await fulfillment.list();
    report.fulfillmentRecordsScanned = records.length;
    report.skippedMockRecords = records.filter(isMockAssetSource).length;
    const assets = [];
    for (const customerId of customerIds) {
      const count = Number(await repository.countForCustomer(customerId, {})) || 0;
      for (let page = 1; page <= Math.max(1, Math.ceil(count / 100)); page += 1) {
        const orders = await repository.listForCustomer(customerId, { page, pageSize: 100, sort: 'newest' });
        for (const order of orders) {
          const orderRecords = records.filter((record) => record.orderId === order.orderId);
          const orderItems = Array.isArray(order.items) ? order.items : [];
          report.missingFulfillment += orderItems.filter((_, index) => !orderRecords.some((record) => record.itemIndex === index || record.orderItemId === `${order.orderId}:item:${index}`)).length;
          const projected = createCustomerAssetRepository({ orderRepository: { countForCustomer: async () => 1, listForCustomer: async () => [order] }, fulfillmentRepository: { persistenceReady: async () => true, findByOrderId: async () => orderRecords, list: async () => orderRecords }, env: { ...env, CUSTOMER_ASSETS_ENABLED: 'true' } });
          const result = await projected.list(customerId);
          assets.push(...result.items);
        }
      }
    }
    report.projectedAssets = assets.length;
    assets.forEach((asset) => {
      if (asset.assetType in report.assetsByType) report.assetsByType[asset.assetType] += 1;
      const key = { ESIM: 'esim', PHYSICAL_SIM: 'physicalSim', DEVICE: 'device', TOPUP: 'topup' }[asset.assetType];
      if (key) report.assetsCreated[key] += 1;
    });
    report.unresolved = report.legacyUnresolved > 0 ? [{ code: 'LEGACY_UNRESOLVED_ORDERS', count: report.legacyUnresolved }] : [];
    return report;
  } catch (error) {
    return emptyReport('unavailable', error?.code === 'DATABASE_URL_REQUIRED' ? 'DATABASE_URL_REQUIRED' : 'DATABASE_UNAVAILABLE');
  } finally {
    if (ownPool && activePool?.end) await activePool.end();
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await backfillCustomerAssets();
  if (process.argv.includes('--write-report')) {
    await fs.mkdir(outputDirectory, { recursive: true });
    const filePath = path.join(outputDirectory, `customer_assets_${now().toISOString().replace(/[-:.TZ]/g, '')}.json`);
    await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    report.reportPath = path.relative(path.resolve(directory, '..'), filePath).replaceAll('\\', '/');
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
