import { useCallback, useEffect, useState } from 'react';
import { getDashboardSummary } from '../../services/customerDashboardApi';
import type { CustomerDashboardSummary } from '../../types/customerDashboard';

export const useCustomerDashboardSummary = () => {
  const [data, setData] = useState<CustomerDashboardSummary | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await getDashboardSummary()); setError(null); } catch (value) { setError(value instanceof Error ? value : new Error('Dashboard unavailable.')); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  return { data, error, loading, reload };
};
