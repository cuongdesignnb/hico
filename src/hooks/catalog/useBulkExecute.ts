import { useCallback, useState } from 'react';
import { executeBulk } from '../../services/catalogBulkApi';
import type { BulkExecuteResponse } from '../../types/catalogBulk';

const key = () => globalThis.crypto?.randomUUID?.() ?? `bulk-execute-${Date.now()}`;

export const useBulkExecute = () => {
  const [result, setResult] = useState<BulkExecuteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const runExecute = useCallback(async (body: Omit<Parameters<typeof executeBulk>[0], 'idempotencyKey'> & { idempotencyKey?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const next = await executeBulk({ ...body, idempotencyKey: body.idempotencyKey ?? key() });
      setResult(next);
      return next;
    } catch (caught) {
      const nextError = caught instanceof Error ? caught : new Error('Không thể execute bulk.');
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, []);
  const clear = useCallback(() => { setResult(null); setError(null); }, []);
  return { result, loading, error, runExecute, clear };
};
