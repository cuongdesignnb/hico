import { useCallback } from 'react';
import { listTopups } from '../../services/customerAssetsApi';
import { useCustomerAssetQuery } from './useCustomerAssetQuery';

export const useCustomerTopups = () => {
  const loader = useCallback((signal?: AbortSignal) => listTopups(signal), []);
  return useCustomerAssetQuery(loader);
};
