import { useCallback, useEffect, useState } from 'react';
import { getCustomerProfile, updateCustomerProfile } from '../../services/customerProfileApi';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';
import type { CustomerProfile } from '../../types/customerProfile';

export const useCustomerProfile = () => {
  const { csrfToken } = useCustomerAuth();
  const [data, setData] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData((await getCustomerProfile()).profile); setError(null); }
    catch (value) { setError(value instanceof Error ? value : new Error('Profile unavailable.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  const save = useCallback(async (input: Partial<Pick<CustomerProfile, 'displayName' | 'locale' | 'timezone' | 'avatarUrl'>>) => { setData((await updateCustomerProfile(input, csrfToken)).profile); }, [csrfToken]);
  return { data, error, loading, reload, save };
};
