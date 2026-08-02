import crypto from 'node:crypto';
import path from 'node:path';
import { atomicWriteJson, readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';

export const createFulfillmentIdempotencyRepository = ({
  filePath = path.join(defaultUploadsDirectory, 'fulfillment_idempotency.json'),
} = {}) => {
  let queue = Promise.resolve();
  const withLock = (operation) => {
    const next = queue.then(operation, operation);
    queue = next.catch(() => undefined);
    return next;
  };
  const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
  const read = async () => {
    const value = await readJson(filePath, []);
    return Array.isArray(value) ? value : [];
  };
  return {
    hash,
    async list() { return read(); },
    async get(key) { return withLock(async () => (await read()).find((record) => record.key === key) ?? null); },
    async save(record) {
      return withLock(async () => {
        const records = await read();
        const existing = records.find((item) => item.key === record.key);
        if (existing) return existing;
        await atomicWriteJson(filePath, [...records, { ...record, createdAt: record.createdAt ?? new Date().toISOString() }]);
        return record;
      });
    },
  };
};
