import crypto from 'node:crypto';
import path from 'node:path';
import { atomicWriteJson, readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';
import { normalizeOrder } from './orderValidation.js';

export const createOrderId = () => `#HICO-CAN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

export const createOrderRepository = ({
  filePath = path.join(defaultUploadsDirectory, 'orders.json'),
} = {}) => {
  let queue = Promise.resolve();
  const withLock = (operation) => {
    const next = queue.then(operation, operation);
    queue = next.catch(() => undefined);
    return next;
  };
  const read = async () => {
    const value = await readJson(filePath, []);
    if (Array.isArray(value)) return value.map(normalizeOrder);
    if (value && typeof value === 'object') return Object.values(value).map(normalizeOrder);
    return [];
  };
  return {
    async list() { return read(); },
    async get(orderId) { return (await read()).find((order) => order.orderId === orderId) ?? null; },
    async create(order) {
      return withLock(async () => {
        const orders = await read();
        if (orders.some((item) => item.orderId === order.orderId)) return orders.find((item) => item.orderId === order.orderId);
        const next = normalizeOrder(order);
        await atomicWriteJson(filePath, [...orders, next]);
        return next;
      });
    },
    async update(orderId, updater) {
      return withLock(async () => {
        const orders = await read();
        const index = orders.findIndex((order) => order.orderId === orderId);
        if (index < 0) return null;
        const current = orders[index];
        const next = normalizeOrder(typeof updater === 'function' ? await updater(current) : { ...current, ...updater });
        orders[index] = next;
        await atomicWriteJson(filePath, orders);
        return next;
      });
    },
  };
};
