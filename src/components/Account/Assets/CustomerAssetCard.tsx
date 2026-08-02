import { Link } from 'react-router-dom';
import type { CustomerAsset } from '../../../types/customerAsset';
import { CustomerAssetStatusBadge } from './CustomerAssetStatusBadge';

const paths: Record<string, string> = { ESIM: 'esim', PHYSICAL_SIM: 'sim-thiet-bi/sim', DEVICE: 'sim-thiet-bi/thiet-bi', TOPUP: 'nap-them' };

export const CustomerAssetCard = ({ asset }: { asset: CustomerAsset }) => <Link className="account-asset-card" to={`/tai-khoan/${paths[asset.assetType]}/${asset.id}`}>
  <div className="account-asset-card-heading"><div><p className="account-kicker">{asset.assetType}</p><h3>{asset.productName}</h3></div><CustomerAssetStatusBadge status={asset.status} /></div>
  <div className="account-asset-card-meta"><span>Don {asset.orderId}</span><span>{asset.quantity} san pham</span></div>
  {asset.assetType === 'ESIM' && <div className="account-asset-flags"><span>{asset.iccidMasked ?? 'ICCID an'}</span><span>{asset.hasQr ? 'Co QR' : 'QR dang cho'}</span></div>}
  {asset.assetType === 'TOPUP' && <div className="account-asset-flags"><span>{asset.simNumberMasked ?? 'SIM an'}</span><span>{asset.duration ?? 'Goi top-up'}</span></div>}
  {(asset.assetType === 'PHYSICAL_SIM' || asset.assetType === 'DEVICE') && <div className="account-asset-flags"><span>{asset.shippingStatus ?? 'Dang xu ly'}</span><span>{asset.trackingAvailable ? 'Co ma van don' : 'Chua co ma van don'}</span></div>}
</Link>;
