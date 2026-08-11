import { Link } from 'react-router-dom';
import type { CustomerAssetList } from '../../types/customerAsset';
import { CustomerAssetCard } from '../../components/Account/Assets/CustomerAssetCard';
import { CustomerAssetState } from '../../components/Account/Assets/CustomerAssetState';

export const AccountAssetListPage = ({ title, lead, data, error, loading, reload, emptyLink = '/san-pham' }: { title: string; lead: string; data: CustomerAssetList | null; error: Error | null; loading: boolean; reload: () => void; emptyLink?: string }) => <>
  <div className="account-page-heading"><div><p className="account-kicker">Tài sản</p><h2>{title}</h2><p className="account-lead">{lead}</p></div><Link className="account-button account-button-primary" to={emptyLink}>Mua thêm</Link></div>
  <CustomerAssetState loading={loading && !data} error={error && !data ? error : null} empty={Boolean(data && data.items.length === 0)} onRetry={() => void reload()} />
  {data && data.items.length > 0 && <div className="account-asset-grid">{data.items.map((asset) => <CustomerAssetCard key={asset.id} asset={asset} />)}</div>}
</>;
