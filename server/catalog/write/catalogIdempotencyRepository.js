import path from 'node:path';
import {
  atomicWriteJson,
  defaultUploadsDirectory,
  readJson,
} from './catalogWritePersistence.js';

export const createCatalogIdempotencyRepository = ({
  recordsFile = path.join(
    defaultUploadsDirectory,
    'catalog_idempotency.json',
  ),
  now = () => new Date(),
  env = process.env,
  ttlHours,
} = {}) => {
  const configuredTtl = ttlHours
    ?? Number.parseInt(env.CATALOG_IDEMPOTENCY_TTL_HOURS, 10);
  const effectiveTtlHours = Number.isInteger(configuredTtl) && configuredTtl > 0
    ? configuredTtl
    : 24;
  const readRecords = async () => {
    const records = await readJson(recordsFile, []);
    if (!Array.isArray(records)) {
      throw new Error('Catalog idempotency storage must contain an array.');
    }
    return records;
  };

  const activeRecords = (records) => {
    const timestamp = now().getTime();
    return records.filter((record) => Date.parse(record.expiresAt) > timestamp);
  };

  return {
    async find(key) {
      const records = activeRecords(await readRecords());
      return records.find((record) => record.key === key) ?? null;
    },

    async save({
      key,
      operation,
      requestHash,
      responseStatus,
      responseBody,
      catalogVersionId,
    }) {
      const records = activeRecords(await readRecords())
        .filter((record) => record.key !== key);
      const createdAt = now();
      const record = {
        key,
        operation,
        requestHash,
        responseStatus,
        responseBody,
        ...(catalogVersionId ? { catalogVersionId } : {}),
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(
          createdAt.getTime() + effectiveTtlHours * 60 * 60 * 1000,
        ).toISOString(),
      };
      records.push(record);
      await atomicWriteJson(recordsFile, records);
      return record;
    },

    async list() {
      return activeRecords(await readRecords());
    },
  };
};
