import { useCallback } from 'react';
import { getEsim } from '../../services/customerAssetsApi';
import { useCustomerAssetDetail } from './useCustomerAssetQuery';

export const useCustomerEsimDetail = (esimId: string | undefined) => {
  const loader = useCallback((signal?: AbortSignal) => getEsim(esimId ?? '', signal), [esimId]);
  return useCustomerAssetDetail(loader, esimId);
};
