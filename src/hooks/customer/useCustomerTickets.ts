import { useCallback, useEffect, useState } from 'react';
import { createCustomerTicket, getCustomerTickets } from '../../services/customerSupportApi';
import type { CustomerSupportList } from '../../types/customerSupport';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';

export const useCustomerTickets = () => {
  const { csrfToken } = useCustomerAuth();
  const [data, setData] = useState<CustomerSupportList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await getCustomerTickets()); setError(null); }
    catch (value) { setError(value instanceof Error ? value : new Error('Support unavailable.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  const create = useCallback(async (input: Record<string, unknown>) => { const result = await createCustomerTicket(input, csrfToken); await reload(); return result; }, [csrfToken, reload]);
  return { data, loading, error, reload, create };
};
