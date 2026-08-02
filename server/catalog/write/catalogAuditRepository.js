import path from 'node:path';
import {
  atomicWriteJson,
  defaultUploadsDirectory,
  readJson,
} from './catalogWritePersistence.js';

export const createCatalogAuditRepository = ({
  recordsFile = path.join(defaultUploadsDirectory, 'catalog_audit.json'),
} = {}) => {
  const readRecords = async () => {
    const records = await readJson(recordsFile, []);
    if (!Array.isArray(records)) {
      throw new Error('Catalog audit storage must contain an array.');
    }
    return records;
  };

  return {
    async append(record) {
      const records = await readRecords();
      records.push(record);
      await atomicWriteJson(recordsFile, records);
      return record;
    },

    async remove(recordId) {
      const records = await readRecords();
      await atomicWriteJson(
        recordsFile,
        records.filter((record) => record.id !== recordId),
      );
    },

    async list({
      entityType,
      entityId,
      offset = 0,
      limit = 100,
    } = {}) {
      const records = (await readRecords())
        .filter((record) => !entityType || record.entityType === entityType)
        .filter((record) => !entityId || record.entityId === entityId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return {
        total: records.length,
        offset,
        limit,
        items: records.slice(offset, offset + limit),
      };
    },
  };
};
