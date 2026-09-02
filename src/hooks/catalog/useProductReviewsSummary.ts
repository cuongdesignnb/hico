import { useEffect, useState } from 'react';
import type { ProductReview } from '../../types/legacy';

export interface ProductReviewsSummary {
  average: number;
  count: number;
  loaded: boolean;
}

const computeAverage = (rows: ProductReview[]): number => {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((total, row) => total + (Number.isFinite(row.rating) ? row.rating : 0), 0);
  return Math.round((sum / rows.length) * 10) / 10;
};

export const useProductReviewsSummary = (productId: string): {
  rows: ProductReview[];
  summary: ProductReviewsSummary;
  reload: () => void;
} => {
  const [rows, setRows] = useState<ProductReview[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setRows([]);
      setLoaded(false);
    });
    fetch(`/api/products/${productId}/reviews`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Không thể tải đánh giá.');
        return response.json() as Promise<ProductReview[]>;
      })
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRows([]);
        setLoaded(true);
      });
    return () => controller.abort();
  }, [productId, attempt]);

  return {
    rows,
    summary: {
      average: computeAverage(rows),
      count: rows.length,
      loaded,
    },
    reload: () => setAttempt((value) => value + 1),
  };
};
