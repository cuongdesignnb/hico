import { createCatalogRepository } from '../catalogRepository.js';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import {
  CatalogStartupValidationError,
  SUPPORTED_CATALOG_SCHEMA_VERSION,
  validateCanonicalCatalogStorage,
} from './catalogStartupValidator.js';

export const CATALOG_NOT_READY_MESSAGE = 'Canonical catalog chưa sẵn sàng.';

export class CatalogNotReadyError extends Error {
  constructor() {
    super(CATALOG_NOT_READY_MESSAGE);
    this.name = 'CatalogNotReadyError';
    this.status = 503;
    this.code = 'CATALOG_NOT_READY';
  }
}

const sourceFromEnv = (env) => env.CATALOG_READ_SOURCE ?? 'canonical';

const parseTtl = (env) => {
  const value = Number.parseInt(env.CATALOG_HEALTH_CACHE_TTL_MS, 10);
  return Number.isFinite(value) && value >= 0 ? value : 30000;
};

const shouldValidateAtStartup = (env) => (
  env.CATALOG_STARTUP_VALIDATION !== 'false'
);

const safeFailure = (error, readSource = 'canonical') => ({
  status: 'unhealthy',
  readSource,
  versionId: null,
  products: 0,
  variants: 0,
  checksumValid: false,
  schemaVersion: SUPPORTED_CATALOG_SCHEMA_VERSION,
  legacyRollbackAvailable: false,
  lastValidatedAt: new Date().toISOString(),
  error: 'Canonical catalog validation failed.',
  code: 'CATALOG_NOT_READY',
  failureCode: error?.code ?? 'CATALOG_NOT_READY',
});

export const createCatalogHealthService = ({
  env = process.env,
  uploadsDirectory,
  validator = validateCanonicalCatalogStorage,
  canonicalRepository = createCanonicalCatalogRepository({ uploadsDirectory }),
  legacyRepository = createCatalogRepository({ uploadsDirectory }),
  now = () => new Date(),
  logger = console,
} = {}) => {
  const cacheTtlMs = parseTtl(env);
  let cached = null;
  let validationPromise = null;

  const source = () => sourceFromEnv(env);

  const hasLegacyRollback = async () => {
    try {
      const legacy = await legacyRepository.readLegacyCatalog();
      return Array.isArray(legacy.destinations) && Array.isArray(legacy.packages);
    } catch {
      return false;
    }
  };

  const legacyHealth = async () => {
    try {
      const legacy = await legacyRepository.readLegacyCatalog();
      const products = [...legacy.destinations, ...legacy.packages];
      const variants = products.reduce(
        (total, product) => total + (Array.isArray(product.variants) ? product.variants.length : 0),
        0,
      );
      return {
        status: 'healthy',
        readSource: 'legacy',
        versionId: null,
        products: products.length,
        variants,
        checksumValid: true,
        schemaVersion: null,
        legacyRollbackAvailable: true,
        lastValidatedAt: now().toISOString(),
      };
    } catch (error) {
      return {
        ...safeFailure(error, 'legacy'),
        readSource: 'legacy',
        error: 'Legacy catalog validation failed.',
      };
    }
  };

  const validate = async ({ force = false } = {}) => {
    if (source() === 'legacy') {
      cached = await legacyHealth();
      return cached;
    }
    if (source() !== 'canonical') {
      cached = {
        ...safeFailure({ code: 'CATALOG_SOURCE_INVALID' }),
        readSource: source(),
        failureCode: 'CATALOG_SOURCE_INVALID',
      };
      return cached;
    }
    if (!force && cached && Date.parse(cached.lastValidatedAt) + cacheTtlMs > now().getTime()) {
      try {
        const pointer = await canonicalRepository.readCurrentManifest();
        const pointerVersion = pointer?.versionId ?? pointer?.migrationId ?? null;
        if (pointerVersion === cached.versionId) return cached;
      } catch {
        // Force a full validation when the pointer cannot be inspected safely.
      }
    }
    if (validationPromise) return validationPromise;
    validationPromise = (async () => {
      const startedAt = now();
      try {
        const result = await validator({ uploadsDirectory });
        cached = {
          status: 'healthy',
          readSource: 'canonical',
          versionId: result.versionId,
          products: result.products,
          variants: result.variants,
          checksumValid: result.checksumValid,
          schemaVersion: result.schemaVersion,
          legacyRollbackAvailable: await hasLegacyRollback(),
          lastValidatedAt: now().toISOString(),
          warnings: result.warnings,
        };
        logger.info(JSON.stringify({
          event: 'catalog_startup_validation',
          status: 'success',
          versionId: result.versionId,
          durationMs: now().getTime() - startedAt.getTime(),
        }));
      } catch (error) {
        cached = {
          ...safeFailure(error),
          readSource: 'canonical',
          lastValidatedAt: now().toISOString(),
        };
        logger.error(JSON.stringify({
          event: 'catalog_startup_validation',
          status: 'failed',
          code: error instanceof CatalogStartupValidationError
            ? error.code
            : 'CATALOG_NOT_READY',
        }));
      } finally {
        validationPromise = null;
      }
      return cached;
    })();
    return validationPromise;
  };

  const getHealth = () => validate();

  return {
    getHealth,
    validate,
    shouldValidateAtStartup: shouldValidateAtStartup(env),
    invalidate() {
      cached = null;
    },
    isCanonicalSource() {
      return source() !== 'legacy';
    },
    async assertHealthy() {
      const health = await getHealth();
      if (health.status !== 'healthy') throw new CatalogNotReadyError();
      return health;
    },
  };
};
