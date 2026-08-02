import crypto from 'node:crypto';
import path from 'node:path';
import { atomicWriteJson, readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';

const hashPayload = (payload) => crypto.createHash('sha256')
  .update(JSON.stringify(payload), 'utf8')
  .digest('hex');

export const createCheckoutIdempotencyRepository = ({
  filePath = path.join(defaultUploadsDirectory, 'checkout_idempotency.json'),
  ttlMs = Number(process.env.CHECKOUT_IDEMPOTENCY_TTL_MS ?? 86400000),
} = {}) => {
  let queue = Promise.resolve();
  const withLock = (operation) => {
    const next = queue.then(operation, operation);
    queue = next.catch(() => undefined);
    return next;
  };
  const read = async () => {
    const records = await readJson(filePath, []);
    const cutoff = Date.now() - ttlMs;
    return records.filter((record) => Date.parse(record.createdAt) >= cutoff);
  };
  return {
    hashPayload,
    hash: hashPayload,
    async list() { return read(); },
    async get(key) {
      return withLock(async () => (await read()).find((record) => record.key === key) ?? null);
    },
    async save({ key, payload, orderId, response }) {
      return withLock(async () => {
        const records = await read();
        const existing = records.find((record) => record.key === key);
        if (existing) return existing;
        const record = {
          key,
          payloadHash: hashPayload(payload),
          orderId,
          response,
          createdAt: new Date().toISOString(),
        };
        await atomicWriteJson(filePath, [...records, record]);
        return record;
      });
    },
  };
};
