import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getPhysicalSim } from '../../services/customerAssetsApi';
import { AccountAssetDetailPage } from './AccountAssetDetailPage';

export const AccountPhysicalSimDetailPage = () => {
  const { assetId } = useParams();
  const loader = useCallback((signal?: AbortSignal) => getPhysicalSim(assetId ?? '', signal), [assetId]);
  return <AccountAssetDetailPage title="Chi tiet SIM vat ly" id={assetId} loader={loader} />;
};
