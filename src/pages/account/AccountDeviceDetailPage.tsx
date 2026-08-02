import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getDevice } from '../../services/customerAssetsApi';
import { AccountAssetDetailPage } from './AccountAssetDetailPage';

export const AccountDeviceDetailPage = () => {
  const { assetId } = useParams();
  const loader = useCallback((signal?: AbortSignal) => getDevice(assetId ?? '', signal), [assetId]);
  return <AccountAssetDetailPage title="Chi tiet thiet bi" id={assetId} loader={loader} />;
};
