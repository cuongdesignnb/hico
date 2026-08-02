import { useCallback } from 'react';
import { listDevices } from '../../services/customerAssetsApi';
import { useCustomerAssetQuery } from './useCustomerAssetQuery';

export const useCustomerDevices = () => {
  const loader = useCallback((signal?: AbortSignal) => listDevices(signal), []);
  return useCustomerAssetQuery(loader);
};
