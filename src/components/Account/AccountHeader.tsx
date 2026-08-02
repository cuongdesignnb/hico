import { ArrowLeft, Bell, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';
import { useUnreadNotificationCount } from '../../hooks/customer/useUnreadNotificationCount';

export const AccountHeader = () => {
  const { customer, logout } = useCustomerAuth();
  const { count } = useUnreadNotificationCount();
  return <header className="account-header">
    <div><Link className="account-back-link" to="/"><ArrowLeft size={16} aria-hidden="true" /> HICO</Link><p className="account-kicker">Customer account</p><h1>Xin chao, {customer?.displayName || 'ban'}</h1></div>
    <div className="account-header-actions"><Link className="account-icon-button account-notification-link" to="/tai-khoan/thong-bao" aria-label="Mo thong bao" title="Thong bao"><Bell size={18} />{count > 0 && <span className="account-notification-badge">{count}</span>}</Link>
    <button type="button" className="account-logout" onClick={() => void logout()}><LogOut size={16} aria-hidden="true" /> Dang xuat</button>
    </div>
  </header>;
};
