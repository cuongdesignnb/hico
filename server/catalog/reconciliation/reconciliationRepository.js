import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateReconciliationRecords } from './reconciliationValidation.js';

const defaultRecordsFile = fileURLToPath(
  new URL('../../uploads/catalog_reconciliation.json', import.meta.url),
);

const parseRecords = (content) => (
  validateReconciliationRecords(JSON.parse(content))
);

export const createReconciliationRepository = ({
  recordsFile = defaultRecordsFile,
} = {}) => {
  const readRecords = async () => {
    try {
      return parseRecords(await readFile(recordsFile, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  };

  const writeRecords = async (records) => {
    validateReconciliationRecords(records);
    await mkdir(path.dirname(recordsFile), { recursive: true });

    const tempFile = `${recordsFile}.${process.pid}.${Date.now()}.tmp`;
    const handle = await open(tempFile, 'wx');

    try {
      await handle.writeFile(`${JSON.stringify(records, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      await rename(tempFile, recordsFile);
    } catch (error) {
      await handle.close().catch(() => undefined);
      await unlink(tempFile).catch(() => undefined);
      throw error;
    }
  };

  return {
    listRecords: readRecords,
    saveRecords: writeRecords,

    async getRecordByVariantId(variantId) {
      const records = await readRecords();
      return records.find((record) => record.variantId === variantId) ?? null;
    },
  };
};
