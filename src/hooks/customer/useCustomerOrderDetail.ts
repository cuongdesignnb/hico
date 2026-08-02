import { useCallback, useEffect, useState } from 'react';
import { getCustomerOrder } from '../../services/customerOrdersApi';
import type { CustomerOrder } from '../../types/customerOrder';

export const useCustomerOrderDetail = (orderId: string) => {
  const [data, setData] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData((await getCustomerOrder(orderId)).order); setError(null); } catch (value) { setError(value instanceof Error ? value : new Error('Order unavailable.')); } finally { setLoading(false); }
  }, [orderId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  return { data, error, loading, reload };
};
