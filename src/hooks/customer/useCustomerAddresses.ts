import { useCallback, useEffect, useState } from 'react';
import { createCustomerAddress, deleteCustomerAddress, getCustomerAddresses, setCustomerDefaultAddress } from '../../services/customerProfileApi';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';
import type { CustomerAddress } from '../../types/customerProfile';

export const useCustomerAddresses = () => {
  const { csrfToken } = useCustomerAuth();
  const [data, setData] = useState<CustomerAddress[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData((await getCustomerAddresses()).addresses); setError(null); }
    catch (value) { setError(value instanceof Error ? value : new Error('Addresses unavailable.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  const create = useCallback(async (input: Partial<CustomerAddress>) => { await createCustomerAddress(input, csrfToken); await reload(); }, [csrfToken, reload]);
  const setDefault = useCallback(async (id: string) => { await setCustomerDefaultAddress(id, csrfToken); await reload(); }, [csrfToken, reload]);
  const remove = useCallback(async (id: string) => { await deleteCustomerAddress(id, csrfToken); await reload(); }, [csrfToken, reload]);
  return { data, error, loading, reload, create, setDefault, remove };
};
