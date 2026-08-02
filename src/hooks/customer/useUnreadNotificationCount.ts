import { useCallback, useEffect, useState } from 'react';
import { getUnreadNotificationCount } from '../../services/customerNotificationApi';

export const useUnreadNotificationCount = () => {
  const [count, setCount] = useState(0);
  const reload = useCallback(async () => { try { setCount(Math.max(0, Number((await getUnreadNotificationCount()).unreadCount) || 0)); } catch { setCount(0); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { count, reload };
};
