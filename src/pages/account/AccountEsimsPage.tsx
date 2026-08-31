import { useCallback } from 'react';
import { listEsims } from '../../services/customerAssetsApi';
import { useCustomerAssetQuery } from '../../hooks/customer/useCustomerAssetQuery';
import { usePendingAssetRefresh } from '../../hooks/customer/usePendingAssetRefresh';
import { AccountAssetListPage } from './AccountAssetListPage';

export const AccountEsimsPage = () => {
  const loader = useCallback((signal?: AbortSignal) => listEsims(signal), []);
  const query = useCustomerAssetQuery(loader);
  usePendingAssetRefresh(Boolean(query.data?.items.some((asset) => asset.status === 'PENDING_CALLBACK' || asset.status === 'PENDING_QR_ASSIGN')), query.reload);
  return <AccountAssetListPage title="eSIM của bạn" lead="Quản lý các eSIM đã được fulfillment cho tài khoản." {...query} />;
};
