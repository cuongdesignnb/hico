import crypto from 'node:crypto';
import { publicSkuForOrderItem } from '../catalog/public/publicSku.js';

const ASSET_TYPES = new Set(['ESIM', 'PHYSICAL_SIM', 'DEVICE', 'TOPUP']);
const MOCK_PATTERN = /mock|demo|sample|fixture/i;

const stringValue = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const first = (...values) => values.map(stringValue).find(Boolean) ?? null;

const maskValue = (value, visible = 4) => {
  const text = stringValue(value);
  if (!text) return null;
  return `${'*'.repeat(Math.max(4, text.length - visible))}${text.slice(-visible)}`;
};

const maskName = (value) => {
  const text = stringValue(value);
  if (!text) return null;
  return text.length < 2 ? '*' : `${text[0]}${'*'.repeat(Math.max(1, text.length - 1))}`;
};

const isMockValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return Object.values(value).some(isMockValue);
  return MOCK_PATTERN.test(String(value));
};

export const isMockAssetSource = (record = {}) => Boolean(
  record.isMock === true
  || isMockValue(record.id)
  || isMockValue(record.providerReference)
  || isMockValue(record.source)
  || isMockValue(record.itemData)
  || isMockValue(record.qrcode)
  || isMockValue(record.qrcodeContent),
);

const assetIdFor = (orderId, itemIndex, assetType) => `asset-${crypto.createHash('sha256').update(`${orderId}:${itemIndex}:${assetType}`).digest('hex').slice(0, 24)}`;

const getAssetType = (item = {}) => {
  const operation = String(item.operation ?? '').toLowerCase();
  const medium = String(item.medium ?? '').toLowerCase();
  if (operation === 'topup') return 'TOPUP';
  if (operation === 'device_sale' || medium === 'device') return 'DEVICE';
  if (medium === 'physical_sim' || operation === 'physical_sim') return 'PHYSICAL_SIM';
  if (medium === 'esim' || operation === 'esim' || item.fulfillmentMethod?.includes('ESIM')) return 'ESIM';
  return null;
};

const statusFor = (record, order) => {
  const state = String(record?.state ?? record?.status ?? order?.status ?? 'PENDING').toUpperCase();
  if (state === 'PENDING_QR_ASSIGN') return 'PENDING_QR_ASSIGN';
  if (state === 'PENDING_CALLBACK' || state === 'PENDING' || state === 'PROCESSING' || state === 'FAILED_RETRYABLE') return 'PENDING_CALLBACK';
  if (state === 'SHIPPED') return 'SHIPPED';
  if (state === 'PROVISIONED') return 'PROVISIONED';
  if (state === 'CANCELLED') return 'CANCELLED';
  return state;
};

const safeCoverage = (item) => ({
  type: first(item.coverageType, item.coverage?.type),
  ids: Array.isArray(item.coverageIds) ? item.coverageIds.filter((value) => typeof value === 'string').slice(0, 50) : [],
});

const baseAsset = ({ assetId, assetType, order, item, record, index }) => {
  const itemData = record?.itemData && typeof record.itemData === 'object' ? record.itemData : {};
  const status = statusFor(record, order);
  const trackingCode = first(record?.trackingCode, itemData.trackingCode);
  return {
    id: assetId,
    assetType,
    orderId: order.orderId,
    orderCreatedAt: order.createdAt ?? null,
    orderStatus: String(order.status ?? '').toUpperCase() || null,
    itemIndex: index,
    productName: first(item.productName, item.name) ?? 'Product',
    productSlug: first(item.productSlug, item.slug),
    productId: first(item.productId),
    variantId: first(item.variantId),
    sku: publicSkuForOrderItem(item),
    quantity: Math.max(1, Number(item.quantity) || 1),
    unitPrice: numberValue(item.unitPrice ?? item.price) ?? 0,
    currency: String(item.currency ?? order.currency ?? 'VND').toUpperCase(),
    operation: first(item.operation),
    medium: first(item.medium),
    supplier: first(item.supplier),
    fulfillmentMethod: first(item.fulfillmentMethod, record?.fulfillmentMethod),
    coverage: safeCoverage(item),
    dataLimit: first(item.dataLimit, itemData.dataLimit),
    duration: first(item.duration, itemData.duration),
    status,
    activationStatus: first(itemData.activationStatus, itemData.activationState),
    activatedAt: first(itemData.activatedAt),
    expiresAt: first(itemData.expiresAt),
    createdAt: first(record?.createdAt, order.createdAt),
    updatedAt: first(record?.updatedAt),
    source: {
      fulfillmentId: record?.id ?? null,
      state: record?.state ?? record?.status ?? null,
    },
    shippingStatus: assetType === 'PHYSICAL_SIM' || assetType === 'DEVICE' ? status : null,
    trackingAvailable: Boolean(trackingCode) && !isMockValue(trackingCode),
    trackingMasked: trackingCode && !isMockValue(trackingCode) ? maskValue(trackingCode) : null,
    recipientMasked: maskName(order.shipping?.recipientName ?? order.shipping?.name ?? order.shippingAddress?.recipientName),
    simNumberMasked: maskValue(first(item.simNumber, item.simNum, itemData.simNumber, itemData.simNum)),
    serialNumberMasked: maskValue(first(item.serialNumber, itemData.serialNumber)),
  };
};

const projectEsim = (asset, record) => {
  const data = record?.itemData && typeof record.itemData === 'object' ? record.itemData : {};
  return {
    ...asset,
    iccidMasked: maskValue(data.iccid),
    hasQr: Boolean(stringValue(data.qrcode)),
    hasLpa: Boolean(stringValue(data.qrcodeContent)),
    hasPin: Boolean(stringValue(data.pin1) || stringValue(data.pin2)),
    hasPuk: Boolean(stringValue(data.puk1) || stringValue(data.puk2)),
    apnAvailable: Boolean(stringValue(data.apnExplain) || stringValue(data.apn)),
  };
};

const projectTopup = (asset, record, item) => {
  const data = record?.itemData && typeof record.itemData === 'object' ? record.itemData : {};
  const providerReference = first(record?.providerReference);
  return {
    ...asset,
    packageName: first(item.productName, item.name),
    simNumberMasked: maskValue(first(item.simNum, item.simNumber, data.simNum, data.simNumber)),
    providerReferenceMasked: providerReference && !isMockValue(providerReference) ? maskValue(providerReference) : null,
    completedAt: first(record?.completedAt),
    failureCode: first(record?.failureCode, record?.lastErrorCode),
  };
};

const itemRecord = (records, orderId, itemIndex) => records.find((record) => (
  record.orderId === orderId
  && (record.itemIndex === itemIndex || record.orderItemId === `${orderId}:item:${itemIndex}`)
  && !isMockAssetSource(record)
)) ?? null;

export const projectCustomerAsset = ({ order, item, record, index }) => {
  const assetType = getAssetType(item);
  if (!assetType || !record || isMockAssetSource(record)) return null;
  const asset = baseAsset({ assetId: assetIdFor(order.orderId, index, assetType), assetType, order, item, record, index });
  if (assetType === 'ESIM') return projectEsim(asset, record);
  if (assetType === 'TOPUP') return projectTopup(asset, record, item);
  return asset;
};

export const projectOwnedAssets = ({ orders = [], fulfillments = [] } = {}) => orders.flatMap((order) => {
  if (order?.ownershipStatus !== 'OWNED' || !order.customerId) return [];
  return (Array.isArray(order.items) ? order.items : []).map((item, index) => projectCustomerAsset({
    order,
    item,
    record: itemRecord(fulfillments, order.orderId, index),
    index,
  })).filter(Boolean);
});

export const projectCustomerAssetSummary = (assets = [], { available = false } = {}) => {
  const count = (type) => assets.filter((asset) => asset.assetType === type).length;
  const pending = (type) => assets.filter((asset) => asset.assetType === type && String(asset.status).startsWith('PENDING')).length;
  const completed = (type) => assets.filter((asset) => asset.assetType === type && ['PROVISIONED', 'SHIPPED'].includes(asset.status)).length;
  return {
    esims: { total: count('ESIM'), active: assets.filter((asset) => asset.assetType === 'ESIM' && asset.activationStatus === 'ACTIVE').length, pending: pending('ESIM') },
    physicalSims: { total: count('PHYSICAL_SIM'), pendingShip: assets.filter((asset) => asset.assetType === 'PHYSICAL_SIM' && asset.status === 'PENDING_SHIP').length, shipped: assets.filter((asset) => asset.status === 'SHIPPED' && asset.assetType === 'PHYSICAL_SIM').length },
    devices: { total: count('DEVICE') },
    topups: { total: count('TOPUP'), pending: pending('TOPUP'), completed: completed('TOPUP') },
    available: { esims: available, physicalSims: available, devices: available, topups: available },
  };
};

export const assetTypes = ASSET_TYPES;
