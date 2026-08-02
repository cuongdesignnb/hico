import {
  mkdir,
  open,
  rename,
  rm,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCatalogRepository } from '../catalogRepository.js';
import {
  createCanonicalCatalogReader,
} from '../canonical/canonicalCatalogReader.js';
import {
  createCanonicalCatalogRepository,
} from '../canonical/canonicalCatalogRepository.js';
import { adaptCanonicalToLegacy } from './legacyCatalogAdapter.js';
import { validateLegacyProjection } from './legacyCatalogValidation.js';
import { createLegacyCatalogParity } from './legacyCatalogParity.js';

const defaultUploadsDirectory = fileURLToPath(
  new URL('../../uploads/', import.meta.url),
);
const WRITE_LOCK_MESSAGE =
  'Catalog đang ở chế độ canonical. Hãy sử dụng API quản lý catalog mới.';

const atomicWrite = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(tempFile, 'wx');
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    await rename(tempFile, filePath);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(tempFile, { force: true }).catch(() => undefined);
    throw error;
  }
};

export class LegacyCatalogWriteLockedError extends Error {
  constructor() {
    super(WRITE_LOCK_MESSAGE);
    this.name = 'LegacyCatalogWriteLockedError';
  }
}

export class LegacyCatalogProjectionError extends Error {
  constructor(message, diagnostics) {
    super(message);
    this.name = 'LegacyCatalogProjectionError';
    this.diagnostics = diagnostics;
  }
}

const normalizeSource = (env) => {
  const source = env.CATALOG_READ_SOURCE ?? 'canonical';
  if (source !== 'legacy' && source !== 'canonical') {
    throw new Error(`Unsupported CATALOG_READ_SOURCE: ${source}`);
  }
  return source;
};

const normalizeVariants = (variants) => (
  Array.isArray(variants)
    ? variants.map((variant) => ({
      ...variant,
      leSIM: variant.leSIM !== undefined ? Boolean(variant.leSIM) : true,
      simType: variant.simType || 'eSIM',
    }))
    : []
);

export const createLegacyCatalogService = ({
  destinationsStore,
  packagesStore,
  env = process.env,
  canonicalReader = createCanonicalCatalogReader({ env }),
  canonicalRepository = createCanonicalCatalogRepository(),
  legacyRepository = createCatalogRepository(),
  uploadsDirectory = defaultUploadsDirectory,
  now = () => new Date(),
  idNow = () => Date.now(),
} = {}) => {
  const readAdapted = async () => {
    const adapted = adaptCanonicalToLegacy(await canonicalReader.readCatalog());
    const validation = validateLegacyProjection(adapted);
    if (!validation.valid) {
      throw new LegacyCatalogProjectionError(
        'Canonical catalog cannot be safely projected to legacy.',
        { ...adapted.diagnostics, errors: validation.errors },
      );
    }
    return adapted;
  };
  const assertWriteEnabled = () => {
    if (normalizeSource(env) !== 'legacy') {
      throw new LegacyCatalogWriteLockedError();
    }
  };

  return {
    async listDestinations() {
      return normalizeSource(env) === 'legacy'
        ? Array.from(destinationsStore.values())
        : (await readAdapted()).destinations;
    },

    async listPackages() {
      return normalizeSource(env) === 'legacy'
        ? Array.from(packagesStore.values())
        : (await readAdapted()).packages;
    },

    createDestination(input) {
      assertWriteEnabled();
      const id = `dest-${idNow()}`;
      const destination = {
        id,
        sku: input.sku || `DEST-${id.toUpperCase()}`,
        name: input.name,
        flag: input.flag,
        dataLimit: input.dataLimit,
        duration: input.duration,
        price: Number.parseFloat(input.price),
        compareAtPrice: input.compareAtPrice
          ? Number.parseFloat(input.compareAtPrice)
          : null,
        wmproductId: input.wmproductId || '',
        image: input.image
          || 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=400&auto=format&fit=crop',
        network: input.network,
        featured: Boolean(input.featured),
        guide: input.guide || '',
        leSIM: input.leSIM !== undefined ? Boolean(input.leSIM) : true,
        variants: normalizeVariants(input.variants),
        seoTitle: input.seoTitle || '',
        seoDescription: input.seoDescription || '',
        seoKeywords: input.seoKeywords || '',
      };
      destinationsStore.set(id, destination);
      return destination;
    },

    updateDestination(id, input) {
      assertWriteEnabled();
      const existing = destinationsStore.get(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...input,
        price: input.price ? Number.parseFloat(input.price) : existing.price,
        compareAtPrice: input.compareAtPrice !== undefined
          ? input.compareAtPrice
            ? Number.parseFloat(input.compareAtPrice)
            : null
          : existing.compareAtPrice,
        featured: input.featured !== undefined
          ? Boolean(input.featured)
          : existing.featured,
        leSIM: input.leSIM !== undefined
          ? Boolean(input.leSIM)
          : existing.leSIM,
        variants: input.variants !== undefined
          ? normalizeVariants(input.variants)
          : existing.variants,
      };
      destinationsStore.set(id, updated);
      return updated;
    },

    deleteDestination(id) {
      assertWriteEnabled();
      destinationsStore.delete(id);
      return { success: true };
    },

    createPackage(input) {
      assertWriteEnabled();
      const id = `pkg-${idNow()}`;
      const legacyPackage = {
        id,
        sku: input.sku || `PKG-${id.toUpperCase()}`,
        name: input.name,
        coverage: input.coverage,
        dataLimit: input.dataLimit,
        duration: input.duration,
        price: Number.parseFloat(input.price),
        compareAtPrice: input.compareAtPrice
          ? Number.parseFloat(input.compareAtPrice)
          : null,
        wmproductId: input.wmproductId || '',
        network: input.network || '',
        description: input.description || '',
        featured: Boolean(input.featured),
        iconType: input.iconType || 'region',
        leSIM: input.leSIM !== undefined ? Boolean(input.leSIM) : true,
        variants: normalizeVariants(input.variants),
        seoTitle: input.seoTitle || '',
        seoDescription: input.seoDescription || '',
        seoKeywords: input.seoKeywords || '',
      };
      packagesStore.set(id, legacyPackage);
      return legacyPackage;
    },

    updatePackage(id, input) {
      assertWriteEnabled();
      const existing = packagesStore.get(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...input,
        price: input.price ? Number.parseFloat(input.price) : existing.price,
        compareAtPrice: input.compareAtPrice !== undefined
          ? input.compareAtPrice
            ? Number.parseFloat(input.compareAtPrice)
            : null
          : existing.compareAtPrice,
        featured: input.featured !== undefined
          ? Boolean(input.featured)
          : existing.featured,
        leSIM: input.leSIM !== undefined
          ? Boolean(input.leSIM)
          : existing.leSIM,
        variants: input.variants !== undefined
          ? normalizeVariants(input.variants)
          : existing.variants,
      };
      packagesStore.set(id, updated);
      return updated;
    },

    deletePackage(id) {
      assertWriteEnabled();
      packagesStore.delete(id);
      return { success: true };
    },

    async getSourceStatus() {
      const source = normalizeSource(env);
      const manifest = await canonicalRepository.readCurrentManifest();
      return {
        readSource: source,
        legacyWriteEnabled: source === 'legacy',
        canonicalWriteEnabled: source === 'canonical',
        canonicalVersion: manifest?.migrationId ?? null,
        canonicalChecksum: manifest?.businessChecksum ?? null,
        rollbackAvailable: Boolean(manifest),
      };
    },

    async runParity() {
      const startedAt = now().toISOString();
      const [legacy, canonical] = await Promise.all([
        legacyRepository.readLegacyCatalog(),
        canonicalRepository.readCatalog({ required: true }),
      ]);
      const adapted = adaptCanonicalToLegacy(canonical);
      const completedAt = now().toISOString();
      const report = createLegacyCatalogParity({
        legacy,
        adapted,
        startedAt,
        completedAt,
      });
      const safeTimestamp = completedAt.replace(/[:.]/g, '-');
      await atomicWrite(
        path.join(
          uploadsDirectory,
          'migration_reports',
          `legacy_adapter_parity_${safeTimestamp}.json`,
        ),
        report,
      );
      return report;
    },
  };
};
