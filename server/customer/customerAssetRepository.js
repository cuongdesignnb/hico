import { projectCustomerAssetSummary, projectOwnedAssets } from './customerAssetProjection.js';

const notReady = () => Object.assign(new Error('Customer assets are not ready.'), { code: 'CUSTOMER_ASSETS_NOT_READY' });
const notFound = () => Object.assign(new Error('Customer asset was not found.'), { code: 'ASSET_NOT_FOUND' });

export const createCustomerAssetRepository = ({ orderRepository, fulfillmentRepository, env = process.env, now = () => new Date() } = {}) => {
  const enabled = String(env.CUSTOMER_ASSETS_ENABLED ?? env.CUSTOMER_ASSETS_AVAILABLE ?? '').toLowerCase() === 'true';
  const hasSources = Boolean(orderRepository?.listForCustomer && orderRepository?.countForCustomer && fulfillmentRepository?.findByOrderId && fulfillmentRepository?.persistenceReady);
  const persistenceReady = async () => hasSources && await fulfillmentRepository.persistenceReady();

  const readOwnedAssets = async (customerId) => {
    if (!enabled || !hasSources || !await persistenceReady()) throw notReady();
    const total = Number(await orderRepository.countForCustomer(customerId, {})) || 0;
    const pageSize = 100;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const orders = [];
    for (let page = 1; page <= pages; page += 1) {
      orders.push(...await orderRepository.listForCustomer(customerId, { page, pageSize, sort: 'newest' }));
    }
    const fulfillments = [];
    for (const order of orders) fulfillments.push(...await fulfillmentRepository.findByOrderId(order.orderId));
    return projectOwnedAssets({ orders, fulfillments });
  };

  return {
    enabled,
    async health() {
      if (!enabled || !hasSources || !await persistenceReady()) return { status: 'not_ready', enabled, persistence: 'json_fulfillment_projection' };
      try {
        await fulfillmentRepository.list();
        return { status: 'healthy', enabled: true, persistence: 'json_fulfillment_projection' };
      } catch { return { status: 'unhealthy', enabled: true, persistence: 'json_fulfillment_projection' }; }
    },
    async summary(customerId) {
      if (!enabled || !hasSources || !await persistenceReady()) return projectCustomerAssetSummary([], { available: false });
      return projectCustomerAssetSummary(await readOwnedAssets(customerId), { available: true });
    },
    async list(customerId, assetType, { page = 1, pageSize = 20 } = {}) {
      const assets = await readOwnedAssets(customerId);
      const filtered = assetType ? assets.filter((asset) => asset.assetType === assetType) : assets;
      const safePage = Math.max(1, Number(page) || 1);
      const safeSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
      const start = (safePage - 1) * safeSize;
      return {
        items: filtered.slice(start, start + safeSize),
        pagination: { page: safePage, pageSize: safeSize, totalItems: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / safeSize)) },
        generatedAt: now().toISOString(),
      };
    },
    async get(customerId, assetId) {
      const asset = (await readOwnedAssets(customerId)).find((item) => item.id === assetId);
      if (!asset) throw notFound();
      return asset;
    },
    async sourceFor(customerId, assetId) {
      const asset = await this.get(customerId, assetId);
      if (!asset.source.fulfillmentId) throw notFound();
      const record = await fulfillmentRepository.get(asset.source.fulfillmentId);
      if (!record || record.orderId !== asset.orderId || (record.itemIndex !== asset.itemIndex && record.orderItemId !== `${asset.orderId}:item:${asset.itemIndex}`)) throw notFound();
      return { asset, record };
    },
    async resolveTopupSimNumber(customerId, assetId) {
      const { asset, record } = await this.sourceFor(customerId, assetId);
      if (!['TOPUP', 'PHYSICAL_SIM'].includes(asset.assetType)) throw notFound();
      const order = await orderRepository.get?.(asset.orderId);
      const item = order?.items?.[asset.itemIndex] ?? {};
      const itemData = record?.itemData && typeof record.itemData === 'object' ? record.itemData : {};
      const simNum = [
        order?.topup?.simNum,
        item.simNum,
        item.simNumber,
        itemData.simNum,
        itemData.simNumber,
      ].find((value) => typeof value === 'string' && /^\d{20}$/.test(value.trim()));
      if (!simNum) throw Object.assign(new Error('Customer SIM number is unavailable.'), { code: 'SIM_NUMBER_UNAVAILABLE' });
      return simNum.trim();
    },
  };
};
