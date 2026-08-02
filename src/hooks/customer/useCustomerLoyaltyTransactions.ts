import { useCallback, useEffect, useState } from 'react';
import { getLoyaltyTransactions } from '../../services/customerLoyaltyApi';
import type { LoyaltyTransactionList } from '../../types/loyalty';

export const useCustomerLoyaltyTransactions = (page: number, pageSize = 10) => {
  const [data, setData] = useState<LoyaltyTransactionList | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await getLoyaltyTransactions(page, pageSize)); setError(null); } catch (value) { setError(value as Error); } finally { setLoading(false); }
  }, [page, pageSize]);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { data, error, loading, reload };
};
