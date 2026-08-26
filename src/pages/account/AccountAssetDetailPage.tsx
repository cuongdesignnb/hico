import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CustomerAsset } from '../../types/customerAsset';
import { useCustomerAssetDetail } from '../../hooks/customer/useCustomerAssetQuery';
import { CustomerAssetStatusBadge } from '../../components/Account/Assets/CustomerAssetStatusBadge';
import { CustomerAssetState } from '../../components/Account/Assets/CustomerAssetState';
import { EsimRevealDialog } from '../../components/Account/Assets/EsimRevealDialog';

const DetailRows = ({ asset }: { asset: CustomerAsset }) => <div className="account-asset-detail-rows">
  <div><span>Đơn hàng</span><Link to={`/tai-khoan/don-hang/${asset.orderId}`}>{asset.orderId}</Link></div>
  <div><span>Sản phẩm</span><strong>{asset.productName}</strong></div>
  <div><span>Trạng thái</span><CustomerAssetStatusBadge status={asset.status} /></div>
  <div><span>Giá đã mua</span><strong>{asset.unitPrice.toLocaleString('vi-VN')} {asset.currency}</strong></div>
  {asset.iccidMasked && <div><span>ICCID</span><strong>{asset.iccidMasked}</strong></div>}
  {asset.simNumberMasked && <div><span>Số SIM</span><strong>{asset.simNumberMasked}</strong></div>}
  {asset.duration && <div><span>Thời hạn</span><strong>{asset.duration}</strong></div>}
  {asset.topupDays && <div><span>Số ngày top-up</span><strong>{asset.topupDays} ngày</strong></div>}
  {(asset.soldDataLimit ?? asset.dataLimit) && <div><span>Data</span><strong>{asset.soldDataLimit ?? asset.dataLimit}</strong></div>}
  {asset.trackingAvailable && <div><span>Van don</span><strong>{asset.trackingMasked}</strong></div>}
</div>;

export const AccountAssetDetailPage = ({ title, id, loader, showReveal = false }: { title: string; id: string | undefined; loader: (signal?: AbortSignal) => Promise<{ asset: CustomerAsset }>; showReveal?: boolean }) => {
  const stableLoader = useCallback((signal?: AbortSignal) => loader(signal), [loader]);
  const { asset, error, loading, reload } = useCustomerAssetDetail(stableLoader, id);
  const [revealing, setRevealing] = useState(false);
  return <>
    <Link className="account-back-link account-content-back" to="/tai-khoan">Về tổng quan</Link>
    <div className="account-page-heading"><div><p className="account-kicker">Tài sản</p><h2>{title}</h2><p className="account-lead">Thông tin này được lấy từ fulfillment của đơn hàng.</p></div><div className="account-header-actions">{asset?.assetType === 'TOPUP' && asset.productSlug && <Link className="account-button account-button-primary" to={`/nap-them/${encodeURIComponent(asset.productSlug)}?simAssetId=${encodeURIComponent(asset.id)}`}>Nạp thêm</Link>}{showReveal && asset && <button className="account-button account-button-primary" type="button" onClick={() => setRevealing(true)}>Hiển thị thông tin</button>}</div></div>
    <CustomerAssetState loading={loading && !asset} error={error && !asset ? error : null} empty={!loading && !error && !asset} onRetry={() => void reload()} />
    {asset && <section className="account-panel"><DetailRows asset={asset} /></section>}
    {revealing && asset && <EsimRevealDialog assetId={asset.id} onClose={() => setRevealing(false)} />}
  </>;
};
