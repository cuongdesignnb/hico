import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  checksumCatalog,
  checksumRecords,
  sha256,
} from '../canonical/canonicalCatalogChecksum.js';
import { validateCanonicalCatalog } from '../canonical/canonicalCatalogValidation.js';
import { cloneSeedCategories } from '../categories/catalogCategories.js';

export const SUPPORTED_CATALOG_SCHEMA_VERSION = 2;
const SUPPORTED_SCHEMA_VERSIONS = new Set([1, 2]);

export class CatalogStartupValidationError extends Error {
  constructor(message, { code, details } = {}) {
    super(message);
    this.name = 'CatalogStartupValidationError';
    this.code = code;
    this.details = details;
  }
}

const safeVersionId = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const fail = (message, code, details) => {
  throw new CatalogStartupValidationError(message, { code, details });
};

const parseJson = async (filePath, code) => {
  let content;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') fail('Canonical catalog file is missing.', 'CATALOG_FILE_MISSING');
    throw error;
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    fail('Canonical catalog JSON is invalid.', code);
  }
};

const parsePointer = async (filePath) => {
  try {
    return await parseJson(filePath, 'CATALOG_POINTER_INVALID');
  } catch (error) {
    if (error instanceof CatalogStartupValidationError && error.code === 'CATALOG_FILE_MISSING') {
      fail('Canonical catalog pointer is missing.', 'CATALOG_POINTER_MISSING');
    }
    throw error;
  }
};

const requireArray = (value, code) => {
  if (!Array.isArray(value)) fail('Canonical catalog file must contain an array.', code);
  return value;
};

const requireFile = async (filePath, code = 'CATALOG_FILE_MISSING') => {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) fail('Canonical catalog file is invalid.', code);
  } catch (error) {
    if (error?.code === 'ENOENT') fail('Canonical catalog file is missing.', code);
    throw error;
  }
};

const safeVersionFile = (uploadsDirectory, relativePath, versionId) => {
  if (typeof relativePath !== 'string' || relativePath.includes('..')) {
    fail('Canonical catalog manifest is invalid.', 'CATALOG_MANIFEST_INVALID');
  }
  const versionsRoot = path.resolve(uploadsDirectory, 'catalog_versions');
  const versionRoot = path.resolve(versionsRoot, versionId);
  const resolved = path.resolve(uploadsDirectory, relativePath);
  if (
    !resolved.startsWith(`${versionRoot}${path.sep}`)
    || path.dirname(resolved) !== versionRoot
    || path.basename(resolved).startsWith('.')
  ) {
    fail('Canonical catalog manifest points to an unsafe file.', 'CATALOG_MANIFEST_INVALID');
  }
  return resolved;
};

const validateManifest = (manifest) => {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('Canonical catalog manifest is invalid.', 'CATALOG_MANIFEST_INVALID');
  }
  const versionId = manifest.versionId ?? manifest.migrationId;
  if (typeof versionId !== 'string' || !safeVersionId.test(versionId) || versionId.startsWith('.')) {
    fail('Canonical catalog version is invalid.', 'CATALOG_VERSION_MISSING');
  }
  const schemaVersion = manifest.schemaVersion ?? SUPPORTED_CATALOG_SCHEMA_VERSION;
  if (!SUPPORTED_SCHEMA_VERSIONS.has(schemaVersion)) {
    fail('Canonical catalog schema version is unsupported.', 'CATALOG_SCHEMA_UNSUPPORTED');
  }
  const checksumFields = ['productsChecksum', 'variantsChecksum', 'businessChecksum'];
  if (schemaVersion === 2) checksumFields.push('categoriesChecksum');
  for (const field of checksumFields) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
      fail('Canonical catalog manifest is invalid.', 'CATALOG_MANIFEST_INVALID');
    }
  }
  return { versionId, schemaVersion };
};

export const validateCanonicalCatalogStorage = async ({
  uploadsDirectory,
} = {}) => {
  const currentFile = path.join(uploadsDirectory, 'catalog_current.json');
  const pointer = await parsePointer(currentFile);
  const { versionId, schemaVersion } = validateManifest(pointer);
  const versionDirectory = path.join(uploadsDirectory, 'catalog_versions', versionId);
  try {
    const info = await stat(versionDirectory);
    if (!info.isDirectory()) fail('Canonical catalog version is missing.', 'CATALOG_VERSION_MISSING');
  } catch (error) {
    if (error?.code === 'ENOENT') fail('Canonical catalog version is missing.', 'CATALOG_VERSION_MISSING');
    throw error;
  }

  const manifestFile = path.join(versionDirectory, 'manifest.json');
  await requireFile(manifestFile, 'CATALOG_MANIFEST_INVALID');
  const manifest = await parseJson(manifestFile, 'CATALOG_MANIFEST_INVALID');
  const versionManifest = validateManifest(manifest);
  if (versionManifest.versionId !== versionId) {
    fail('Canonical catalog pointer and manifest do not match.', 'CATALOG_MANIFEST_INVALID');
  }
  const pointerChecksumFields = ['productsChecksum', 'variantsChecksum', 'businessChecksum'];
  if (schemaVersion === 2) pointerChecksumFields.push('categoriesChecksum');
  for (const field of pointerChecksumFields) {
    if (manifest[field] !== pointer[field]) {
      fail('Canonical catalog pointer and manifest do not match.', 'CATALOG_MANIFEST_INVALID');
    }
  }

  const productsFile = safeVersionFile(uploadsDirectory, pointer.productsFile, versionId);
  const variantsFile = safeVersionFile(uploadsDirectory, pointer.variantsFile, versionId);
  const categoriesFile = schemaVersion === 2
    ? safeVersionFile(uploadsDirectory, pointer.categoriesFile, versionId)
    : null;
  await requireFile(productsFile);
  await requireFile(variantsFile);
  if (categoriesFile) await requireFile(categoriesFile);
  const products = requireArray(await parseJson(productsFile, 'CATALOG_FILE_MISSING'), 'CATALOG_FILE_MISSING');
  const variants = requireArray(await parseJson(variantsFile, 'CATALOG_FILE_MISSING'), 'CATALOG_FILE_MISSING');
  const categories = categoriesFile
    ? requireArray(await parseJson(categoriesFile, 'CATALOG_FILE_MISSING'), 'CATALOG_FILE_MISSING')
    : cloneSeedCategories();
  const checksums = checksumCatalog({ products, variants, categories });
  const legacyBusinessChecksum = sha256(`${checksumRecords(products, { business: true })}:${checksumRecords(variants, { business: true })}`);
  if (
    checksumRecords(products) !== pointer.productsChecksum
    || checksumRecords(variants) !== pointer.variantsChecksum
    || (schemaVersion === 2 && checksumRecords(categories) !== pointer.categoriesChecksum)
    || (schemaVersion === 2 ? checksums.businessChecksum : legacyBusinessChecksum) !== pointer.businessChecksum
  ) {
    fail('Canonical catalog checksum validation failed.', 'CATALOG_CHECKSUM_MISMATCH');
  }

  const validation = validateCanonicalCatalog({ products, variants, categories });
  if (!validation.valid) {
    fail('Canonical catalog references or required fields are invalid.', 'CATALOG_REFERENCE_INVALID', {
      errors: validation.errors,
    });
  }

  return {
    healthy: true,
    versionId,
    schemaVersion,
    products: products.length,
    variants: variants.length,
    categories: categories.length,
    checksumValid: true,
    businessChecksumValid: true,
    warnings: validation.warnings,
  };
};
