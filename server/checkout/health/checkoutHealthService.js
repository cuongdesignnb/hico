import { validateCanonicalCheckoutStorage } from './checkoutStartupValidator.js';
import { readCheckoutEngine } from '../checkoutValidation.js';

export const CHECKOUT_NOT_READY_MESSAGE = 'Canonical checkout validation failed.';

export class CheckoutNotReadyError extends Error {
  constructor() {
    super(CHECKOUT_NOT_READY_MESSAGE);
    this.name = 'CheckoutNotReadyError';
    this.status = 503;
    this.code = 'CHECKOUT_NOT_READY';
  }
}

const parseTtl = (env) => {
  const value = Number.parseInt(env.CHECKOUT_HEALTH_CACHE_TTL_MS, 10);
  return Number.isFinite(value) && value >= 0 ? value : 30000;
};

const safeHealth = ({ result, engine, now }) => ({
  status: result?.ready ? 'healthy' : 'unhealthy',
  engine: engine ?? result?.engine ?? null,
  error: result?.ready ? undefined : CHECKOUT_NOT_READY_MESSAGE,
  code: result?.ready ? undefined : 'CHECKOUT_NOT_READY',
  blockers: result?.blockers?.map(({ code, message }) => ({ code, message })) ?? [],
  warnings: result?.warnings?.map(({ code, message }) => ({ code, message })) ?? [],
  metadata: result?.metadata ?? {},
  lastValidatedAt: now().toISOString(),
});

export const createCheckoutHealthService = ({
  env = process.env,
  validator = validateCanonicalCheckoutStorage,
  validatorDependencies = {},
  now = () => new Date(),
  logger = console,
} = {}) => {
  const cacheTtlMs = parseTtl(env);
  let cached = null;
  let validationPromise = null;

  const validate = async ({ force = false } = {}) => {
    if (!force && cached && Date.parse(cached.lastValidatedAt) + cacheTtlMs > now().getTime()) return cached;
    if (validationPromise) return validationPromise;
    validationPromise = (async () => {
      let engine = null;
      try { engine = readCheckoutEngine(env); } catch (error) {
        cached = safeHealth({ result: { ready: false, engine: null, blockers: [{ code: error.code ?? 'CHECKOUT_ENGINE_INVALID', message: 'Checkout engine configuration is invalid.' }] }, engine: null, now });
        return cached;
      }
      try {
        const result = await validator({ ...validatorDependencies, env });
        cached = safeHealth({ result, engine, now });
        logger.info(JSON.stringify({
          event: 'checkout_startup_validation',
          status: cached.status,
          engine,
          blockerCount: cached.blockers.length,
        }));
      } catch (error) {
        cached = safeHealth({
          result: { ready: false, engine, blockers: [{ code: error.code ?? 'CHECKOUT_VALIDATION_ERROR', message: 'Checkout validation could not be completed.' }] },
          engine,
          now,
        });
        logger.error(JSON.stringify({ event: 'checkout_startup_validation', status: 'failed', engine, blockerCount: 1 }));
      } finally {
        validationPromise = null;
      }
      return cached;
    })();
    return validationPromise;
  };

  return {
    getHealth: () => validate(),
    validate,
    invalidate() { cached = null; },
    shouldValidateAtStartup: env.CHECKOUT_STARTUP_VALIDATION !== 'false',
    async assertHealthy() {
      const health = await validate();
      if (health.status !== 'healthy') throw new CheckoutNotReadyError();
      return health;
    },
  };
};
