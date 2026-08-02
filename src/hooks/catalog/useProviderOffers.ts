import { useEffect, useState } from 'react';
import { getWorldmoveOffers } from '../../services/providerApi';
import type { ProviderOffer } from '../../types/provider';

export const useProviderOffers = () => {
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getWorldmoveOffers(controller.signal)
      .then(setOffers)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải Provider Offer.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { offers, loading, error };
};
