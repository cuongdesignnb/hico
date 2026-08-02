import { useCallback } from 'react';
import { listEsims } from '../../services/customerAssetsApi';
import { useCustomerAssetQuery } from './useCustomerAssetQuery';

export const useCustomerEsims = () => {
  const loader = useCallback((signal?: AbortSignal) => listEsims(signal), []);
  return useCustomerAssetQuery(loader);
};
