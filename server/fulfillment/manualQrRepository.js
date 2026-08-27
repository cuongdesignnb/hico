import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { atomicWriteJson, readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { CheckoutError } from '../checkout/checkoutError.js';

export const defaultManualQrDirectory = path.join(path.dirname(defaultUploadsDirectory), 'private', 'manual-qrs');
export const defaultManualQrImageDirectory = path.join(defaultManualQrDirectory, 'images');

const hasImage = (record) => Boolean(
  (typeof record?.storageKey === 'string' && record.storageKey.trim())
  || (typeof record?.qrcode === 'string' && record.qrcode.trim()),
);
const safeStorageKey = (value) => path.basename(String(value ?? ''));
const extensionForMime = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
});

export const createManualQrRepository = ({
  filePath = path.join(defaultManualQrDirectory, 'manual_qrs.json'),
  legacyFilePath = path.join(defaultUploadsDirectory, 'manual_qrs.json'),
  imageDirectory = defaultManualQrImageDirectory,
} = {}) => {
  let queue = Promise.resolve();
  const withLock = (operation) => {
    const next = queue.then(operation, operation);
    queue = next.catch(() => undefined);
    return next;
  };
  const readList = async (source) => {
    const value = await readJson(source, []);
    return Array.isArray(value) ? value : Object.values(value ?? {});
  };
  const read = async () => {
    const primary = await readList(filePath);
    if (!legacyFilePath || path.resolve(filePath) === path.resolve(legacyFilePath)) return primary;
    const legacy = await readList(legacyFilePath);
    const byId = new Map(legacy.map((record) => [record?.id, { ...record, legacy: true }]));
    primary.forEach((record) => byId.set(record?.id, record));
    return [...byId.values()].filter((record) => record?.id);
  };
  const fileFor = (record) => record?.storageKey
    ? path.join(imageDirectory, safeStorageKey(record.storageKey))
    : null;
  const persistedRecords = (records) => records.map(({ legacy: _legacy, ...record }) => record);
  return {
    async list() { return read(); },
    async get(id) { return (await read()).find((record) => record.id === id) ?? null; },
    async getAssigned({ orderId, orderItemId }) { return (await read()).find((record) => record.assignedOrderId === orderId && record.assignedOrderItemId === orderItemId) ?? null; },
    async getSecret(id) {
      const record = await this.get(id);
      if (!record || !record.storageKey) return record;
      try {
        const buffer = await readFile(fileFor(record));
        return { ...record, qrcode: `data:${record.mimeType};base64,${buffer.toString('base64')}` };
      } catch (error) {
        if (error?.code === 'ENOENT') return record;
        throw error;
      }
    },
    async readImage(id) {
      const record = await this.get(id);
      if (!record?.storageKey) return null;
      try {
        return { record, buffer: await readFile(fileFor(record)), mimeType: record.mimeType };
      } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
      }
    },
    async upload({ variantId, upload }) {
      if (!variantId || !upload?.buffer || !upload?.type || !extensionForMime[upload.type]) {
        throw Object.assign(new Error('Manual QR upload is incomplete.'), { code: 'UPLOAD_INVALID' });
      }
      const storageKey = `${crypto.randomUUID()}${extensionForMime[upload.type]}`;
      const imagePath = path.join(imageDirectory, storageKey);
      await mkdir(imageDirectory, { recursive: true });
      await writeFile(imagePath, upload.buffer, { flag: 'wx', mode: 0o640 });
      try {
        const record = {
          id: `qr-${crypto.randomUUID()}`,
          variantId,
          storageKey,
          mimeType: upload.type,
          assignedOrderId: null,
          assignedOrderItemId: null,
          createdAt: new Date().toISOString(),
        };
        const records = await read();
        await atomicWriteJson(filePath, [...persistedRecords(records), record]);
        return record;
      } catch (error) {
        await rm(imagePath, { force: true }).catch(() => undefined);
        throw error;
      }
    },
    async remove(id) {
      return withLock(async () => {
        const records = await read();
        const record = records.find((item) => item.id === id);
        if (!record) return false;
        if (record.assignedOrderId) throw new CheckoutError('QR đã được gán cho đơn hàng và không thể xóa.', 'MANUAL_QR_ASSIGNED', 409);
        const filePathForRecord = fileFor(record);
        if (filePathForRecord) await rm(filePathForRecord, { force: true });
        await atomicWriteJson(filePath, persistedRecords(records.filter((item) => item.id !== id)));
        return true;
      });
    },
    async reserve({ variantId, orderId, orderItemId }) {
      return withLock(async () => {
        const records = await read();
        const alreadyAssigned = records.find((record) => (
          record.assignedOrderId === orderId && record.assignedOrderItemId === orderItemId
        ));
        if (alreadyAssigned) return alreadyAssigned;
        const available = records.find((record) => (
          record.variantId === variantId && !record.assignedOrderId && hasImage(record)
        ));
        if (!available) throw new CheckoutError('Kho QR cho gói này hiện đã hết.', 'MANUAL_QR_UNAVAILABLE', 409);
        const reserved = {
          ...available,
          assignedOrderId: orderId,
          assignedOrderItemId: orderItemId,
          assignedAt: new Date().toISOString(),
        };
        const index = records.findIndex((record) => record.id === available.id);
        records[index] = reserved;
        await atomicWriteJson(filePath, persistedRecords(records));
        return reserved;
      });
    },
    async assign({ id, variantId, orderId, orderItemId }) {
      return withLock(async () => {
        const records = await read();
        const existing = records.find((record) => (
          record.assignedOrderId === orderId && record.assignedOrderItemId === orderItemId
        ));
        if (existing) {
          if (existing.id !== id) throw new CheckoutError('Đơn hàng đã được gán một QR khác.', 'MANUAL_QR_ASSIGNED', 409);
          return existing;
        }
        const index = records.findIndex((record) => record.id === id);
        const record = index >= 0 ? records[index] : null;
        if (!record) throw new CheckoutError('Không tìm thấy QR.', 'MANUAL_QR_NOT_FOUND', 404);
        if (record.variantId !== variantId) throw new CheckoutError('QR không thuộc variant của đơn hàng.', 'MANUAL_QR_VARIANT_MISMATCH', 409);
        if (record.assignedOrderId || record.assignedOrderItemId) throw new CheckoutError('QR đã được gán cho đơn hàng khác.', 'MANUAL_QR_ASSIGNED', 409);
        if (!hasImage(record)) throw new CheckoutError('QR chưa có ảnh hợp lệ.', 'MANUAL_QR_UNAVAILABLE', 409);
        const assigned = {
          ...record,
          assignedOrderId: orderId,
          assignedOrderItemId: orderItemId,
          assignedAt: new Date().toISOString(),
        };
        records[index] = assigned;
        await atomicWriteJson(filePath, persistedRecords(records));
        return assigned;
      });
    },
  };
};
