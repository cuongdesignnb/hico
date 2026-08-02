import { useCallback, useEffect, useState } from 'react';
import { getLoyaltySummary } from '../../services/customerLoyaltyApi';
import type { LoyaltySummary } from '../../types/loyalty';

export const useCustomerLoyalty = () => {
  const [data, setData] = useState<LoyaltySummary | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await getLoyaltySummary()); setError(null); } catch (value) { setError(value as Error); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { data, error, loading, reload };
};
