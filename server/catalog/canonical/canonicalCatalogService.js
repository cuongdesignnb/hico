import { createCanonicalCatalogRepository } from './canonicalCatalogRepository.js';

export const createCanonicalCatalogService = ({
  repository = createCanonicalCatalogRepository(),
} = {}) => ({
  readCatalog: (options) => repository.readCatalog(options),
  readStatus: () => repository.readCurrentManifest(),
});
