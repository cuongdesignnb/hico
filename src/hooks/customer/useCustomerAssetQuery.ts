import { useCallback, useEffect, useState } from 'react';
import type { CustomerAsset, CustomerAssetList } from '../../types/customerAsset';

export const useCustomerAssetQuery = (loader: (signal?: AbortSignal) => Promise<CustomerAssetList>, enabled = true) => {
  const [data, setData] = useState<CustomerAssetList | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try { setData(await loader()); setError(null); } catch (value) { setError(value as Error); } finally { setLoading(false); }
  }, [enabled, loader]);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { data, error, loading, reload };
};

export const useCustomerAssetDetail = (loader: (signal?: AbortSignal) => Promise<{ asset: CustomerAsset }>, id: string | undefined) => {
  const [asset, setAsset] = useState<CustomerAsset | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { setAsset((await loader()).asset); setError(null); } catch (value) { setError(value as Error); } finally { setLoading(false); }
  }, [id, loader]);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { asset, error, loading, reload };
};
