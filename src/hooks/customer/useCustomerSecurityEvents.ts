import { useCallback, useEffect, useState } from 'react';
import { getCustomerSecurityEvents } from '../../services/customerProfileApi';
import type { CustomerSecurityEventList } from '../../types/customerProfile';

export const useCustomerSecurityEvents = () => {
  const [data, setData] = useState<CustomerSecurityEventList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await getCustomerSecurityEvents()); setError(null); }
    catch (value) { setError(value instanceof Error ? value : new Error('Security events unavailable.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { data, loading, error, reload };
};
