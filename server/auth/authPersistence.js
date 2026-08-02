import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const readJsonArray = async (filePath) => {
  try {
    const value = JSON.parse(await readFile(filePath, 'utf8'));
    if (!Array.isArray(value)) throw new Error('Authentication storage must contain an array.');
    return value;
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
};

export const writeJsonArray = async (filePath, records) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
};
