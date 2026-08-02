import { useCallback, useEffect, useState } from 'react';
import { getAssetSummary } from '../../services/customerAssetsApi';
import type { CustomerAssetSummary } from '../../types/customerAsset';

export const useCustomerAssetSummary = () => {
  const [data, setData] = useState<CustomerAssetSummary | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await getAssetSummary()); setError(null); } catch (value) { setError(value as Error); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { data, error, loading, reload };
};
