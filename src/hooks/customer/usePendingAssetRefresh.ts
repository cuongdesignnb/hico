import { useEffect, useRef } from 'react';

const DELAYS = [5_000, 10_000, 20_000, 30_000];

export const usePendingAssetRefresh = (hasPending: boolean, reload: () => Promise<void>) => {
  const reloadRef = useRef(reload);
  const inFlight = useRef(false);
  useEffect(() => { reloadRef.current = reload; }, [reload]);
  useEffect(() => {
    if (!hasPending || document.visibilityState !== 'visible') return undefined;
    let active = true;
    let attempt = 0;
    let timer: number | undefined;
    const schedule = () => {
      if (!active || attempt >= DELAYS.length || document.visibilityState !== 'visible') return;
      timer = window.setTimeout(async () => {
        if (!active || inFlight.current) return schedule();
        inFlight.current = true;
        try { await reloadRef.current(); } finally { inFlight.current = false; attempt += 1; schedule(); }
      }, DELAYS[attempt]);
    };
    schedule();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [hasPending]);
};
