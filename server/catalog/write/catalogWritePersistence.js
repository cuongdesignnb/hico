import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const defaultUploadsDirectory = fileURLToPath(
  new URL('../../uploads/', import.meta.url),
);

export const serializeJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

export const readJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
};

export const atomicWriteJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(tempFile, 'wx');

  try {
    await handle.writeFile(serializeJson(value), 'utf8');
    await handle.sync();
    await handle.close();
    await rename(tempFile, filePath);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(tempFile, { force: true }).catch(() => undefined);
    throw error;
  }
};

