import { createHash } from 'node:crypto';
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanonicalCatalogReader } from '../catalog/canonical/canonicalCatalogReader.js';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { validateCanonicalCatalogStorage } from '../catalog/health/catalogStartupValidator.js';

export const defaultUploadsDirectory = fileURLToPath(
  new URL('../uploads/', import.meta.url),
);
export const defaultBackupRoot = path.join(
  fileURLToPath(new URL('../', import.meta.url)),
  'backups',
  'catalog-cutover',
);

export const sha256File = async (filePath) => (
  createHash('sha256').update(await readFile(filePath)).digest('hex')
);

export const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

export const parseOption = (name, fallback) => {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
};

export const timestampLabel = () => new Date().toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');

export const pathForReport = (value) => value.split(path.sep).join('/');

export const assertArrayFile = async (uploadsDirectory, name) => {
  const parsed = await readJson(path.join(uploadsDirectory, name));
  if (!Array.isArray(parsed)) throw new Error(`${name} must contain an array.`);
  return parsed;
};

export const listFiles = async (rootDirectory, relativeDirectory = '') => {
  const directory = path.join(rootDirectory, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(rootDirectory, relative));
    else files.push(relative);
  }
  return files;
};

export const copyFileIfPresent = async ({ sourceRoot, destinationRoot, relativePath, required = false }) => {
  const source = path.join(sourceRoot, relativePath);
  try {
    const info = await stat(source);
    if (!info.isFile()) throw new Error('not a file');
  } catch (error) {
    if (required || error?.code !== 'ENOENT') throw error;
    return null;
  }
  const destination = path.join(destinationRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
  return relativePath;
};

export const collectBackupFiles = async (backupDirectory) => {
  const relativeFiles = await listFiles(backupDirectory);
  return relativeFiles.filter((relativePath) => path.basename(relativePath) !== 'backup_manifest.json');
};

export const restoreBackupToTemp = async (backupDirectory) => {
  const tempDirectory = await fsTempDirectory('hico-catalog-restore-');
  const files = await collectBackupFiles(backupDirectory);
  for (const relativePath of files) {
    await copyFileIfPresent({
      sourceRoot: backupDirectory,
      destinationRoot: tempDirectory,
      relativePath,
      required: true,
    });
  }
  return tempDirectory;
};

export const verifyCanonicalBoot = async (uploadsDirectory) => {
  const health = await validateCanonicalCatalogStorage({ uploadsDirectory });
  const restoredReader = createCanonicalCatalogReader({
    env: { CATALOG_READ_SOURCE: 'canonical', CATALOG_CANONICAL_FALLBACK: 'false' },
    canonicalRepository: createCanonicalCatalogRepository({ uploadsDirectory }),
  });
  await restoredReader.readCatalog();
  return health;
};

const fsTempDirectory = (prefix) => mkdtemp(path.join(os.tmpdir(), prefix));

export const removeDirectory = (directory) => rm(directory, { recursive: true, force: true });
