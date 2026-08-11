import { NavLink } from 'react-router-dom';
import { accountLinks } from './accountLinks';

export const AccountSidebar = () => <aside className="account-sidebar" aria-label="Tài khoản">
  <p className="account-sidebar-title">Tài khoản</p>
  <nav>{accountLinks.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `account-nav-link${isActive ? ' active' : ''}`}><Icon size={18} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
</aside>;
