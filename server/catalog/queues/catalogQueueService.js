import path from 'node:path';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { normalizeSku } from '../canonical/canonicalSkuConflicts.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { defaultUploadsDirectory, readJson } from '../write/catalogWritePersistence.js';

const REVIEW_STATUSES = new Set([
  'NOT_FOUND',
  'MISSING_WMPRODUCT_ID',
  'TYPE_CONFLICT',
  'LEGACY_CONFLICT',
  'INACTIVE_PROVIDER_OFFER',
  'IGNORED_BY_ADMIN',
  'MANUAL_PROCESSING',
]);

const expectedProviderType = (variant, product) => {
  if (product?.operation === 'topup') return 2;
  if (variant.medium === 'physical_sim') return 1;
  return 0;
};

const expectedProviderMethod = (offer) => {
  if (offer?.providerProductType === 0 && offer.leSIM === true) return 'WORLDMOVE_ESIM_REDEEM';
  if (offer?.providerProductType === 0 && offer.leSIM === false) return 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM';
  if (offer?.providerProductType === 1) return 'WORLDMOVE_PHYSICAL_ORDER';
  if (offer?.providerProductType === 2) return 'WORLDMOVE_TOPUP';
  return undefined;
};

const pageResult = (items, query) => {
  const offset = Math.max(0, Number.parseInt(query.offset ?? 0, 10) || 0);
  const limit = Math.min(200, Math.max(1, Number.parseInt(query.limit ?? query.pageSize ?? 50, 10) || 50));
  const filtered = query.search
    ? items.filter((item) => JSON.stringify(item).toLocaleLowerCase('vi').includes(String(query.search).toLocaleLowerCase('vi')))
    : items;
  return {
    total: filtered.length,
    offset,
    limit,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    items: filtered.slice(offset, offset + limit),
  };
};

export const createCatalogQueueService = ({
  uploadsDirectory = defaultUploadsDirectory,
  catalogRepository = createCanonicalCatalogRepository({ uploadsDirectory }),
  providerOfferRepository = createProviderOfferRepository(),
} = {}) => {
  const readContext = async () => {
    const catalog = await catalogRepository.readCatalog({ required: true });
    const [providerOffers, manualQrs, reconciliation] = await Promise.all([
      providerOfferRepository.listOffers(),
      readJson(path.join(uploadsDirectory, 'manual_qrs.json'), []),
      readJson(path.join(uploadsDirectory, 'catalog_reconciliation.json'), []),
    ]);
    return { ...catalog, providerOffers, manualQrs, reconciliation };
  };

  const productMap = (products) => new Map(products.map((product) => [product.id, product]));

  return {
    async listSkuConflicts(query = {}) {
      const { products, variants } = await readContext();
      const productsById = productMap(products);
      const groups = new Map();
      variants.forEach((variant) => {
        const normalized = normalizeSku(variant.sku);
        if (!normalized) return;
        if (!groups.has(normalized)) groups.set(normalized, []);
        groups.get(normalized).push(variant);
      });
      const items = [...groups.entries()]
        .filter(([, group]) => group.length > 1)
        .map(([normalizedSku, group]) => ({
          groupId: `sku:${normalizedSku}`,
          sku: group[0].sku,
          normalizedSku,
          variantCount: group.length,
          variants: group.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            productId: variant.productId,
            productName: productsById.get(variant.productId)?.name ?? null,
            active: Boolean(variant.active),
            archived: Boolean(variant.archived),
            needsReview: Boolean(variant.needsReview),
          })),
        }));
      return pageResult(items, query);
    },

    async listNeedsReview(query = {}) {
      const { products, variants, reconciliation } = await readContext();
      const productsById = productMap(products);
      const reconciliationByVariant = new Map(reconciliation.map((record) => [record.variantId, record]));
      const items = variants
        .map((variant) => {
          const record = reconciliationByVariant.get(variant.id);
          const status = record?.status ?? (variant.fulfillmentMethod === 'MANUAL_PROCESSING' ? 'MANUAL_PROCESSING' : null);
          if (!variant.needsReview && !REVIEW_STATUSES.has(status)) return null;
          return {
            id: variant.id,
            sku: variant.sku,
            productId: variant.productId,
            productName: productsById.get(variant.productId)?.name ?? null,
            status: status ?? 'NEEDS_REVIEW',
            needsReview: Boolean(variant.needsReview),
            fulfillmentSource: variant.fulfillmentMethod,
          };
        })
        .filter(Boolean);
      return pageResult(items, query);
    },

    async listProviderIssues(query = {}) {
      const { products, variants, providerOffers } = await readContext();
      const productsById = productMap(products);
      const offersById = new Map(providerOffers.map((offer) => [offer.id, offer]));
      const items = [];
      variants.forEach((variant) => {
        if (variant.supplier !== 'worldmove' && !String(variant.fulfillmentMethod).startsWith('WORLDMOVE_')) return;
        const product = productsById.get(variant.productId);
        const offer = offersById.get(variant.providerOfferId);
        let issueCode = null;
        let issueMessage = null;
        if (!variant.providerOfferId || !offer) {
          issueCode = 'MISSING_MAPPING';
          issueMessage = 'Chưa có provider mapping.';
        } else if (!offer.active) {
          issueCode = 'INACTIVE_PROVIDER_OFFER';
          issueMessage = 'Provider offer đang inactive.';
        } else if (offer.wmproductId !== variant.wmproductId) {
          issueCode = 'MAPPING_DRIFT';
          issueMessage = 'Mã provider mapping không còn khớp.';
        } else if (offer.providerProductType !== expectedProviderType(variant, product)
          || expectedProviderMethod(offer) !== variant.fulfillmentMethod) {
          issueCode = 'TYPE_MISMATCH';
          issueMessage = 'Provider offer không đúng loại gói bán.';
        }
        if (issueCode) items.push({
          id: variant.id,
          sku: variant.sku,
          productId: variant.productId,
          productName: product?.name ?? null,
          issueCode,
          issueMessage,
          providerOfferId: variant.providerOfferId ?? null,
        });
      });
      return pageResult(items, query);
    },

    async listInventoryWarnings(query = {}) {
      const { products, variants, manualQrs } = await readContext();
      const productsById = productMap(products);
      const variantIds = new Set(variants.map((variant) => variant.id));
      const qrCount = new Map();
      const items = [];
      manualQrs.forEach((qr) => {
        if (!variantIds.has(qr.variantId)) {
          items.push({
            id: qr.id,
            code: 'ORPHAN_MANUAL_QR',
            variantId: qr.variantId,
            message: 'QR thủ công không còn gắn với gói bán.',
          });
          return;
        }
        if (!qr.assignedOrderId) qrCount.set(qr.variantId, (qrCount.get(qr.variantId) ?? 0) + 1);
      });
      variants.forEach((variant) => {
        const product = productsById.get(variant.productId);
        if (variant.fulfillmentMethod === 'HICO_MANUAL_QR' && !qrCount.get(variant.id)) {
          items.push({
            id: `qr:${variant.id}`,
            code: 'MANUAL_QR_EMPTY',
            variantId: variant.id,
            sku: variant.sku,
            productName: product?.name ?? null,
            message: 'Gói thủ công chưa có QR khả dụng.',
          });
        }
        if (variant.fulfillmentMethod === 'HICO_PHYSICAL_STOCK') {
          if (!Number.isInteger(variant.stock) || variant.stock < 0) {
            items.push({
              id: `stock-invalid:${variant.id}`,
              code: 'STOCK_INVALID',
              variantId: variant.id,
              sku: variant.sku,
              productName: product?.name ?? null,
              message: 'Tồn kho không hợp lệ.',
            });
          } else if (variant.stock === 0) {
            items.push({
              id: `stock-empty:${variant.id}`,
              code: 'OUT_OF_STOCK',
              variantId: variant.id,
              sku: variant.sku,
              productName: product?.name ?? null,
              stock: variant.stock,
              message: 'Gói đã hết tồn kho.',
            });
          } else if (variant.stock <= 5) {
            items.push({
              id: `stock-low:${variant.id}`,
              code: 'LOW_STOCK',
              variantId: variant.id,
              sku: variant.sku,
              productName: product?.name ?? null,
              stock: variant.stock,
              message: 'Tồn kho sắp hết.',
            });
          }
        }
      });
      return pageResult(items, query);
    },
  };
};
