import path from 'node:path';
import { atomicWriteJson, readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { CheckoutError } from '../checkout/checkoutError.js';

export const createInventoryRepository = ({
  inventoryFile = path.join(defaultUploadsDirectory, 'inventory.json'),
  movementsFile = path.join(defaultUploadsDirectory, 'inventory_movements.json'),
} = {}) => {
  let queue = Promise.resolve();
  const withLock = (operation) => {
    const next = queue.then(operation, operation);
    queue = next.catch(() => undefined);
    return next;
  };
  const list = async (file, fallback) => {
    const value = await readJson(file, fallback);
    return Array.isArray(value) ? value : Object.values(value ?? {});
  };
  return {
    async list() { return list(inventoryFile, []); },
    async listMovements() { return list(movementsFile, []); },
    async health() {
      await Promise.all([list(inventoryFile, []), list(movementsFile, [])]);
      return { readable: true, writable: true };
    },
    async reserve({ variant, orderId, orderItemId, quantity }) {
      return withLock(async () => {
        const variantId = variant.variantId ?? variant.id;
        const movements = await list(movementsFile, []);
        const key = `${orderId}:${orderItemId}:HICO_PHYSICAL_STOCK`;
        const existing = movements.find((movement) => movement.idempotencyKey === key);
        if (existing) return existing;
        const inventory = await list(inventoryFile, []);
        const source = inventory.find((record) => record.variantId === variantId || record.sku === (variant.soldSku ?? variant.sku));
        const available = source ? Number(source.available ?? source.quantity ?? source.stock) : Number(variant.stock);
        if (!Number.isFinite(available) || available < quantity) {
          throw new CheckoutError('Kho SIM vật lý không đủ hàng.', 'PHYSICAL_STOCK_UNAVAILABLE', 409);
        }
        const used = movements
          .filter((movement) => movement.variantId === variantId && movement.type === 'reserve')
          .reduce((sum, movement) => sum + movement.quantity, 0);
        if (available - used < quantity) {
          throw new CheckoutError('Kho SIM vật lý không đủ hàng.', 'PHYSICAL_STOCK_UNAVAILABLE', 409);
        }
        const movement = {
          id: `movement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          idempotencyKey: key,
          variantId,
          sku: variant.soldSku ?? variant.sku,
          orderId,
          orderItemId,
          quantity,
          type: 'reserve',
          createdAt: new Date().toISOString(),
        };
        await atomicWriteJson(movementsFile, [...movements, movement]);
        return movement;
      });
    },
  };
};
