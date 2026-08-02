import { useCallback, useEffect, useState } from 'react';
import { listCustomerOrders } from '../../services/customerOrdersApi';
import type { CustomerOrdersResponse } from '../../types/customerOrder';

export const useCustomerOrders = (page: number, status?: string) => {
  const [data, setData] = useState<CustomerOrdersResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await listCustomerOrders({ page, pageSize: 10, status })); setError(null); } catch (value) { setError(value instanceof Error ? value : new Error('Orders unavailable.')); } finally { setLoading(false); }
  }, [page, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  return { data, error, loading, reload };
};
