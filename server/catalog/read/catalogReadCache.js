import path from 'node:path';

const caches = new Map();

const cacheKeyFor = (value) => path.resolve(value ?? 'default-catalog');
const versionFor = (manifest) => manifest?.versionId ?? manifest?.migrationId ?? null;

export const createCatalogReadCache = ({ key, readManifest, loadCatalog } = {}) => {
  const cacheKey = cacheKeyFor(key);

  const read = async ({ required = false } = {}) => {
    const manifest = await readManifest();
    const versionId = versionFor(manifest);
    const entry = caches.get(cacheKey);

    if (versionId && entry?.versionId === versionId && entry.value) {
      return entry.value;
    }
    if (versionId && entry?.versionId === versionId && entry.promise) {
      return entry.promise;
    }

    const promise = Promise.resolve(loadCatalog({ manifest, required }));
    if (!versionId) return promise;

    caches.set(cacheKey, { versionId, promise });
    try {
      const value = await promise;
      caches.set(cacheKey, { versionId, value });
      return value;
    } catch (error) {
      if (caches.get(cacheKey)?.promise === promise) caches.delete(cacheKey);
      throw error;
    }
  };

  return {
    read,
    invalidate() {
      caches.delete(cacheKey);
    },
    cacheKey,
  };
};

export const invalidateCatalogReadCache = (key) => {
  caches.delete(cacheKeyFor(key));
};

export const clearCatalogReadCaches = () => {
  caches.clear();
};

export const catalogVersionId = versionFor;
