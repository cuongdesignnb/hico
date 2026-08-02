import { useCallback, useEffect, useState } from 'react';
import { getCustomerSessions, logoutAllCustomerSessions, revokeCustomerSession } from '../../services/customerProfileApi';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';
import type { CustomerSession } from '../../types/customerProfile';

export const useCustomerSessions = () => {
  const { csrfToken } = useCustomerAuth();
  const [data, setData] = useState<CustomerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData((await getCustomerSessions()).sessions); setError(null); }
    catch (value) { setError(value instanceof Error ? value : new Error('Sessions unavailable.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  const revoke = useCallback(async (id: string) => { await revokeCustomerSession(id, csrfToken); await reload(); }, [csrfToken, reload]);
  const revokeAll = useCallback(async () => { await logoutAllCustomerSessions(csrfToken); await reload(); }, [csrfToken, reload]);
  return { data, loading, error, reload, revoke, revokeAll };
};
