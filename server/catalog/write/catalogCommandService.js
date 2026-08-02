import { createCatalogIdempotencyRepository } from './catalogIdempotencyRepository.js';
import {
  assertCanonicalWriteSource,
  CatalogWriteError,
  requestHash,
  requireIdempotencyKey,
} from './catalogWriteValidation.js';

export const createCatalogCommandService = ({
  env = process.env,
  idempotencyRepository = createCatalogIdempotencyRepository(),
} = {}) => {
  let queue = Promise.resolve();

  const executeSerialized = (callback) => {
    const pending = queue.then(callback, callback);
    queue = pending.catch(() => undefined);
    return pending;
  };

  return {
    execute({
      operation,
      idempotencyKey,
      request,
      handler,
    }) {
      return executeSerialized(async () => {
        assertCanonicalWriteSource(env);
        const key = requireIdempotencyKey(idempotencyKey);
        const hash = requestHash(operation, request);
        const existing = await idempotencyRepository.find(key);
        if (existing) {
          if (
            existing.operation !== operation
            || existing.requestHash !== hash
          ) {
            throw new CatalogWriteError(
              'Idempotency key đã được sử dụng cho request khác.',
              { status: 409, code: 'IDEMPOTENCY_CONFLICT' },
            );
          }
          return {
            status: existing.responseStatus,
            body: existing.responseBody,
            replayed: true,
          };
        }

        const result = await handler({
          commandId: key,
          requestHash: hash,
        });
        await idempotencyRepository.save({
          key,
          operation,
          requestHash: hash,
          responseStatus: result.status,
          responseBody: result.body,
          catalogVersionId: result.catalogVersionId,
        });
        return { ...result, replayed: false };
      });
    },
  };
};

