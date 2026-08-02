import { useCallback } from 'react';
import { listTopups } from '../../services/customerAssetsApi';
import { useCustomerAssetQuery } from '../../hooks/customer/useCustomerAssetQuery';
import { AccountAssetListPage } from './AccountAssetListPage';

export const AccountTopupsPage = () => {
  const loader = useCallback((signal?: AbortSignal) => listTopups(signal), []);
  const query = useCustomerAssetQuery(loader);
  return <AccountAssetListPage title="Lich su nap them" lead="Theo doi cac lan nap them da duoc xac nhan." {...query} />;
};
