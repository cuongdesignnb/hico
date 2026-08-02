import { useCallback, useState } from 'react';
import { publishProduct, publishVariant, unpublishProduct, unpublishVariant } from '../../services/catalogPublishApi';

const key = () => globalThis.crypto?.randomUUID?.() ?? `publish-${Date.now()}`;

export const usePublishWorkflow = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(async ({ entityType, id, publish, body }: { entityType: 'product' | 'variant'; id: string; publish: boolean; body: Record<string, unknown> }) => {
    setLoading(true);
    setError(null);
    try {
      const request = { ...body, idempotencyKey: body.idempotencyKey ?? key() };
      if (entityType === 'product') return publish ? await publishProduct(id, request) : await unpublishProduct(id, request);
      return publish ? await publishVariant(id, request) : await unpublishVariant(id, request);
    } catch (caught) {
      const nextError = caught instanceof Error ? caught : new Error('Không thể cập nhật trạng thái publish.');
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, []);
  return { loading, error, run };
};
