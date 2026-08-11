import { useCallback } from 'react';
import { listTopups } from '../../services/customerAssetsApi';
import { useCustomerAssetQuery } from '../../hooks/customer/useCustomerAssetQuery';
import { AccountAssetListPage } from './AccountAssetListPage';

export const AccountTopupsPage = () => {
  const loader = useCallback((signal?: AbortSignal) => listTopups(signal), []);
  const query = useCustomerAssetQuery(loader);
  return <AccountAssetListPage title="Lịch sử nạp thêm" lead="Theo dõi các lần nạp thêm đã được xác nhận." {...query} />;
};
