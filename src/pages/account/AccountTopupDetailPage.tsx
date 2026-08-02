import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getTopup } from '../../services/customerAssetsApi';
import { AccountAssetDetailPage } from './AccountAssetDetailPage';

export const AccountTopupDetailPage = () => {
  const { topupId } = useParams();
  const loader = useCallback((signal?: AbortSignal) => getTopup(topupId ?? '', signal), [topupId]);
  return <AccountAssetDetailPage title="Chi tiet nap them" id={topupId} loader={loader} />;
};
