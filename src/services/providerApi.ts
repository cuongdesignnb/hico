import type {
  ProviderOffer,
  ProviderSyncResult,
} from '../types/provider';

const getErrorMessage = (payload: unknown) => {
  if (
    typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  return 'Không thể xử lý danh mục Worldmove.';
};

const requestJson = async <T>(
  url: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, init);
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as T;
};

export const getWorldmoveOffers = (signal?: AbortSignal) => (
  requestJson<ProviderOffer[]>(
    '/api/admin/providers/worldmove/offers',
    { signal },
  )
);

export const getWorldmoveOffer = (
  offerId: string,
  signal?: AbortSignal,
) => (
  requestJson<ProviderOffer>(
    `/api/admin/providers/worldmove/offers/${encodeURIComponent(offerId)}`,
    { signal },
  )
);

export const syncWorldmoveOffers = () => (
  requestJson<ProviderSyncResult>(
    '/api/admin/providers/worldmove/sync',
    { method: 'POST' },
  )
);
