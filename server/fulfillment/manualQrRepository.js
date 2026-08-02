import path from 'node:path';
import { atomicWriteJson, readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { CheckoutError } from '../checkout/checkoutError.js';

export const createManualQrRepository = ({
  filePath = path.join(defaultUploadsDirectory, 'manual_qrs.json'),
} = {}) => {
  let queue = Promise.resolve();
  const withLock = (operation) => {
    const next = queue.then(operation, operation);
    queue = next.catch(() => undefined);
    return next;
  };
  const read = async () => {
    const value = await readJson(filePath, []);
    return Array.isArray(value) ? value : Object.values(value ?? {});
  };
  return {
    async list() { return read(); },
    async reserve({ variantId, orderId, orderItemId }) {
      return withLock(async () => {
        const records = await read();
        const alreadyAssigned = records.find((record) => (
          record.assignedOrderId === orderId && record.assignedOrderItemId === orderItemId
        ));
        if (alreadyAssigned) return alreadyAssigned;
        const available = records.find((record) => (
          record.variantId === variantId && !record.assignedOrderId && record.qrcode
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
        await atomicWriteJson(filePath, records);
        return reserved;
      });
    },
  };
};
