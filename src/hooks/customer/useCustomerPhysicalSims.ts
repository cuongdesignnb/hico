import { useCallback } from 'react';
import { listPhysicalSims } from '../../services/customerAssetsApi';
import { useCustomerAssetQuery } from './useCustomerAssetQuery';

export const useCustomerPhysicalSims = () => {
  const loader = useCallback((signal?: AbortSignal) => listPhysicalSims(signal), []);
  return useCustomerAssetQuery(loader);
};
