import { Link } from 'react-router-dom';
import { AlertTriangle, PackageOpen } from 'lucide-react';
import { AccountLoadingState } from '../AccountLoadingState';
import { AccountErrorState } from '../AccountErrorState';

export const CustomerAssetState = ({ loading, error, empty, onRetry }: { loading: boolean; error: Error | null; empty: boolean; onRetry: () => void }) => {
  if (loading) return <AccountLoadingState />;
  if (error) return error.message.includes('chua san sang') || error.message.includes('not ready') ? <section className="account-empty-state"><AlertTriangle size={28} /><strong>Tai san chua san sang</strong><p>Nguon fulfillment chua duoc kich hoat cho customer.</p><Link className="account-button" to="/tai-khoan">Ve tong quan</Link></section> : <AccountErrorState onRetry={onRetry} />;
  if (empty) return <section className="account-empty-state"><PackageOpen size={28} /><strong>Chua co tai san</strong><p>Tai san se xuat hien sau khi don hang co fulfillment hop le.</p></section>;
  return null;
};
