import { ArrowLeft, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';

export const AccountHeader = () => {
  const { customer, logout } = useCustomerAuth();
  return <header className="account-header">
    <div><Link className="account-back-link" to="/"><ArrowLeft size={16} aria-hidden="true" /> HICO</Link><p className="account-kicker">Customer account</p><h1>Xin chao, {customer?.displayName || 'ban'}</h1></div>
    <button type="button" className="account-logout" onClick={() => void logout()}><LogOut size={16} aria-hidden="true" /> Dang xuat</button>
  </header>;
};
