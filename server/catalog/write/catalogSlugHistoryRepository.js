import path from 'node:path';
import {
  atomicWriteJson,
  defaultUploadsDirectory,
  readJson,
} from './catalogWritePersistence.js';

export const createCatalogSlugHistoryRepository = ({
  recordsFile = path.join(
    defaultUploadsDirectory,
    'catalog_slug_history.json',
  ),
} = {}) => {
  const readRecords = async () => {
    const records = await readJson(recordsFile, []);
    if (!Array.isArray(records)) {
      throw new Error('Catalog slug history storage must contain an array.');
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

    async list(entityId) {
      return (await readRecords()).filter(
        (record) => !entityId || record.entityId === entityId,
      );
    },
  };
};
