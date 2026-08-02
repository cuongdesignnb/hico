import { useEffect, useState } from 'react';
import { getCatalogSourceStatus } from '../../services/catalogWriteApi';
import type { CatalogSourceStatus } from '../../types/productWizard';

export const useCatalogSourceStatus = () => {
  const [status, setStatus] = useState<CatalogSourceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getCatalogSourceStatus()
      .then((value) => { if (active) setStatus(value); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Không thể kiểm tra nguồn catalog.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { status, loading, error };
};
