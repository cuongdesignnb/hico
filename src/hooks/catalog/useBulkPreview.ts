import { useCallback, useState } from 'react';
import { previewBulk } from '../../services/catalogBulkApi';
import type { BulkPreviewResponse, BulkRequest } from '../../types/catalogBulk';

const key = () => globalThis.crypto?.randomUUID?.() ?? `bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useBulkPreview = () => {
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const runPreview = useCallback(async (request: Omit<BulkRequest, 'idempotencyKey'> & { idempotencyKey?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await previewBulk({ ...request, idempotencyKey: request.idempotencyKey ?? key() });
      setPreview(result);
      return result;
    } catch (caught) {
      const nextError = caught instanceof Error ? caught : new Error('Không thể tạo preview bulk.');
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return { preview, loading, error, runPreview, clear };
};
