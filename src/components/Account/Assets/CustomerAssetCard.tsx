import { Link } from 'react-router-dom';
import type { CustomerAsset } from '../../../types/customerAsset';
import { CustomerAssetStatusBadge } from './CustomerAssetStatusBadge';

const paths: Record<string, string> = { ESIM: 'esim', PHYSICAL_SIM: 'sim-thiet-bi/sim', DEVICE: 'sim-thiet-bi/thiet-bi', TOPUP: 'nap-them' };

export const CustomerAssetCard = ({ asset }: { asset: CustomerAsset }) => <Link className="account-asset-card" to={`/tai-khoan/${paths[asset.assetType]}/${asset.id}`}>
  <div className="account-asset-card-heading"><div><p className="account-kicker">{asset.assetType}</p><h3>{asset.productName}</h3></div><CustomerAssetStatusBadge status={asset.status} /></div>
  <div className="account-asset-card-meta"><span>Đơn {asset.orderId}</span><span>{asset.quantity} sản phẩm</span></div>
  {asset.assetType === 'ESIM' && <div className="account-asset-flags"><span>{asset.iccidMasked ?? 'ICCID ẩn'}</span><span>{asset.hasQr ? 'Có QR' : 'QR đang chờ'}</span></div>}
  {asset.assetType === 'TOPUP' && <div className="account-asset-flags"><span>{asset.simNumberMasked ?? 'SIM ẩn'}</span><span>{asset.topupDays ? `${asset.topupDays} ngày` : asset.duration ?? 'Gói top-up'}</span></div>}
  {(asset.assetType === 'PHYSICAL_SIM' || asset.assetType === 'DEVICE') && <div className="account-asset-flags"><span>{asset.shippingStatus ?? 'Đang xử lý'}</span><span>{asset.trackingAvailable ? 'Có mã vận đơn' : 'Chưa có mã vận đơn'}</span></div>}
</Link>;
