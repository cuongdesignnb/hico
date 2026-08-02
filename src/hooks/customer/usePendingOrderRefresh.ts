import { useEffect, useRef } from 'react';

const DELAYS = [5_000, 10_000, 20_000, 30_000];

export const usePendingOrderRefresh = (hasPending: boolean, reload: () => Promise<void>) => {
  const inFlight = useRef(false);
  const attempt = useRef(0);
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);
  useEffect(() => {
    if (!hasPending || document.visibilityState !== 'visible') return undefined;
    let active = true;
    let timer: number | undefined;
    const schedule = () => {
      if (!active || attempt.current >= DELAYS.length || document.visibilityState !== 'visible') return;
      timer = window.setTimeout(async () => {
        if (!active || inFlight.current) return schedule();
        inFlight.current = true;
        try { await reloadRef.current(); } finally { inFlight.current = false; attempt.current += 1; schedule(); }
      }, DELAYS[attempt.current]);
    };
    schedule();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [hasPending]);
};
