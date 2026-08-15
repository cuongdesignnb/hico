import { mapLegacyCatalog } from '../catalogMapper.js';
import { createCatalogRepository } from '../catalogRepository.js';
import { createCanonicalCatalogRepository } from './canonicalCatalogRepository.js';
import { cloneSeedCategories } from '../categories/catalogCategories.js';

export const createCanonicalCatalogReader = ({
  legacyRepository = createCatalogRepository(),
  canonicalRepository = createCanonicalCatalogRepository(),
  env = process.env,
  logger = console,
} = {}) => ({
  async readCatalog() {
    const source = env.CATALOG_READ_SOURCE ?? 'canonical';
    if (source === 'legacy') {
      return {
        ...mapLegacyCatalog(await legacyRepository.readLegacyCatalog()),
        categories: cloneSeedCategories(),
      };
    }
    if (source !== 'canonical') {
      throw new Error(`Unsupported CATALOG_READ_SOURCE: ${source}`);
    }

    try {
      const { products, variants, categories, manifest } = await canonicalRepository.readCatalog({
        required: true,
      });
      return { products, variants, categories, manifest };
    } catch (error) {
      if (env.CATALOG_CANONICAL_FALLBACK !== 'true') throw error;
      logger.warn(
        `[catalog] Canonical source failed; falling back to legacy: ${error.message}`,
      );
      return {
        ...mapLegacyCatalog(await legacyRepository.readLegacyCatalog()),
        categories: cloneSeedCategories(),
      };
    }
  },
});
