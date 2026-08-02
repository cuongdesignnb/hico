import { useCallback, useEffect, useState } from 'react';
import { getReferralOverview } from '../../services/customerReferralApi';
import type { CustomerReferralOverview } from '../../types/referral';

export const useCustomerReferrals = () => {
  const [data, setData] = useState<CustomerReferralOverview | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await getReferralOverview()); setError(null); } catch (value) { setError(value instanceof Error ? value : new Error('Referral unavailable.')); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { data, error, loading, reload };
};
