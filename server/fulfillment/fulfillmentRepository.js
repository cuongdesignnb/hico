import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson, readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';

export const createFulfillmentId = () => `ful-${crypto.randomUUID()}`;

export const createFulfillmentRepository = ({
  filePath = path.join(defaultUploadsDirectory, 'fulfillments.json'),
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
    async persistenceReady() {
      try { await fs.access(filePath); return true; } catch { return false; }
    },
    async list() { return read(); },
    async get(id) { return (await read()).find((record) => record.id === id) ?? null; },
    async findByOrderId(orderId) { return (await read()).filter((record) => record.orderId === orderId); },
    async findByProviderReference(reference) { return (await read()).filter((record) => record.providerReference === reference); },
    async findByItemData(field, value) {
      return (await read()).filter((record) => record.itemData?.[field] === value);
    },
    async create(record) {
      return withLock(async () => {
        const records = await read();
        const existing = records.find((item) => item.id === record.id);
        if (existing) return existing;
        await atomicWriteJson(filePath, [...records, record]);
        return record;
      });
    },
    async update(id, updater) {
      return withLock(async () => {
        const records = await read();
        const index = records.findIndex((record) => record.id === id);
        if (index < 0) return null;
        const next = typeof updater === 'function' ? await updater(records[index]) : { ...records[index], ...updater };
        records[index] = next;
        await atomicWriteJson(filePath, records);
        return next;
      });
    },
  };
};
