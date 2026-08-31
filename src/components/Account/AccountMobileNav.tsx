import { NavLink } from 'react-router-dom';
import { accountLinks } from './accountLinks';

export const AccountMobileNav = () => <nav className="account-mobile-nav" aria-label="Tài khoản trên di động">
  {accountLinks.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `account-mobile-link${isActive ? ' active' : ''}`}><Icon size={17} aria-hidden="true" /><span>{label}</span></NavLink>)}
</nav>;
