import { useCallback, useEffect, useState } from 'react';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';
import { getCustomerNotifications, markAllCustomerNotificationsRead, markCustomerNotificationRead } from '../../services/customerNotificationApi';
import type { CustomerNotificationList } from '../../types/customerNotification';

export const useCustomerNotifications = (page = 1) => {
  const { csrfToken } = useCustomerAuth();
  const [data, setData] = useState<CustomerNotificationList | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await getCustomerNotifications(page)); setError(null); } catch (value) { setError(value instanceof Error ? value : new Error('Notifications unavailable.')); } finally { setLoading(false); }
  }, [page]);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  const markRead = useCallback(async (id: string) => { await markCustomerNotificationRead(id, csrfToken); await reload(); }, [csrfToken, reload]);
  const readAll = useCallback(async () => { await markAllCustomerNotificationsRead(csrfToken); await reload(); }, [csrfToken, reload]);
  return { data, error, loading, reload, markRead, readAll };
};
