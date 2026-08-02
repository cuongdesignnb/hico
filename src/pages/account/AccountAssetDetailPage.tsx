import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CustomerAsset } from '../../types/customerAsset';
import { useCustomerAssetDetail } from '../../hooks/customer/useCustomerAssetQuery';
import { CustomerAssetStatusBadge } from '../../components/Account/Assets/CustomerAssetStatusBadge';
import { CustomerAssetState } from '../../components/Account/Assets/CustomerAssetState';
import { EsimRevealDialog } from '../../components/Account/Assets/EsimRevealDialog';

const DetailRows = ({ asset }: { asset: CustomerAsset }) => <div className="account-asset-detail-rows">
  <div><span>Don hang</span><Link to={`/tai-khoan/don-hang/${asset.orderId}`}>{asset.orderId}</Link></div>
  <div><span>San pham</span><strong>{asset.productName}</strong></div>
  <div><span>Trang thai</span><CustomerAssetStatusBadge status={asset.status} /></div>
  {asset.iccidMasked && <div><span>ICCID</span><strong>{asset.iccidMasked}</strong></div>}
  {asset.simNumberMasked && <div><span>So SIM</span><strong>{asset.simNumberMasked}</strong></div>}
  {asset.duration && <div><span>Thoi han</span><strong>{asset.duration}</strong></div>}
  {asset.dataLimit && <div><span>Data</span><strong>{asset.dataLimit}</strong></div>}
  {asset.trackingAvailable && <div><span>Van don</span><strong>{asset.trackingMasked}</strong></div>}
</div>;

export const AccountAssetDetailPage = ({ title, id, loader, showReveal = false }: { title: string; id: string | undefined; loader: (signal?: AbortSignal) => Promise<{ asset: CustomerAsset }>; showReveal?: boolean }) => {
  const stableLoader = useCallback((signal?: AbortSignal) => loader(signal), [loader]);
  const { asset, error, loading, reload } = useCustomerAssetDetail(stableLoader, id);
  const [revealing, setRevealing] = useState(false);
  return <>
    <Link className="account-back-link account-content-back" to="/tai-khoan">Ve tong quan</Link>
    <div className="account-page-heading"><div><p className="account-kicker">Tai san</p><h2>{title}</h2><p className="account-lead">Thong tin nay duoc lay tu fulfillment cua don hang.</p></div>{showReveal && asset && <button className="account-button account-button-primary" type="button" onClick={() => setRevealing(true)}>Hien thi thong tin</button>}</div>
    <CustomerAssetState loading={loading && !asset} error={error && !asset ? error : null} empty={!loading && !error && !asset} onRetry={() => void reload()} />
    {asset && <section className="account-panel"><DetailRows asset={asset} /></section>}
    {revealing && asset && <EsimRevealDialog assetId={asset.id} onClose={() => setRevealing(false)} />}
  </>;
};
