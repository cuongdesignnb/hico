import { Link } from 'react-router-dom';
import { AlertTriangle, PackageOpen } from 'lucide-react';
import { AccountLoadingState } from '../AccountLoadingState';
import { AccountErrorState } from '../AccountErrorState';

export const CustomerAssetState = ({ loading, error, empty, onRetry }: { loading: boolean; error: Error | null; empty: boolean; onRetry: () => void }) => {
  if (loading) return <AccountLoadingState />;
  if (error) return error.message.includes('chua san sang') || error.message.includes('not ready') ? <section className="account-empty-state"><AlertTriangle size={28} /><strong>Tài sản chưa sẵn sàng</strong><p>Nguồn fulfillment chưa được kích hoạt cho Customer.</p><Link className="account-button" to="/tai-khoan">Về tổng quan</Link></section> : <AccountErrorState onRetry={onRetry} />;
  if (empty) return <section className="account-empty-state"><PackageOpen size={28} /><strong>Chưa có tài sản</strong><p>Tài sản sẽ xuất hiện sau khi đơn hàng có fulfillment hợp lệ.</p></section>;
  return null;
};
