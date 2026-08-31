import { useCallback } from 'react';
import { listDevices, listPhysicalSims } from '../../services/customerAssetsApi';
import { useCustomerAssetQuery } from '../../hooks/customer/useCustomerAssetQuery';
import { usePendingAssetRefresh } from '../../hooks/customer/usePendingAssetRefresh';
import { AccountAssetListPage } from './AccountAssetListPage';

export const AccountPhysicalSimsPage = () => {
  const simLoader = useCallback((signal?: AbortSignal) => listPhysicalSims(signal), []);
  const deviceLoader = useCallback((signal?: AbortSignal) => listDevices(signal), []);
  const sims = useCustomerAssetQuery(simLoader);
  const devices = useCustomerAssetQuery(deviceLoader);
  const combined = sims.data && devices.data ? { ...sims.data, items: [...sims.data.items, ...devices.data.items] } : null;
  usePendingAssetRefresh(Boolean(combined?.items.some((asset) => asset.status === 'PENDING_SHIP')), async () => { await Promise.all([sims.reload(), devices.reload()]); });
  return <AccountAssetListPage title="SIM vật lý và thiết bị" lead="Theo dõi giao hàng và trạng thái các sản phẩm vật lý." data={combined} error={sims.error ?? devices.error} loading={sims.loading || devices.loading} reload={() => { void sims.reload(); void devices.reload(); }} />;
};
