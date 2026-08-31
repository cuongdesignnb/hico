import { useEffect, useState } from 'react';
import { getPublicProductBySlug } from '../../services/publicSeoApi';
import type { PublicProduct } from '../../types/publicCatalog';

export const usePublicProductBySlug = (slug: string) => {
  const [product, setProduct] = useState<PublicProduct | null | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setProduct(undefined);
      setError(null);
      setRedirect(null);
    });
    getPublicProductBySlug(slug, controller.signal)
      .then((result: PublicProduct | { redirect: string; permanent: true }) => {
        if ('redirect' in result) { setRedirect(result.redirect); return; }
        setProduct(result);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason : new Error('Không thể tải thông tin sản phẩm.'));
        setProduct(null);
      });
    return () => controller.abort();
  }, [attempt, slug]);

  return { product, error, redirect, reload: () => setAttempt((value) => value + 1) };
};
