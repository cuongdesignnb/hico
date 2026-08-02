import { useCallback, useState } from 'react';
import { getProductReadiness } from '../../services/catalogWriteApi';
import type { ProductReadinessResult } from '../../types/productWizard';

export const useProductReadiness = () => {
  const [readiness, setReadiness] = useState<ProductReadinessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkReadiness = useCallback(async (productId: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await getProductReadiness(productId);
      setReadiness(result);
      return result;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Không thể kiểm tra publish readiness.';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { readiness, loading, error, checkReadiness };
};
