import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getEsim } from '../../services/customerAssetsApi';
import { AccountAssetDetailPage } from './AccountAssetDetailPage';

export const AccountEsimDetailPage = () => {
  const { esimId } = useParams();
  const loader = useCallback((signal?: AbortSignal) => getEsim(esimId ?? '', signal), [esimId]);
  return <AccountAssetDetailPage title="Chi tiet eSIM" id={esimId} loader={loader} showReveal />;
};
