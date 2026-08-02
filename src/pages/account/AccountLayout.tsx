import { Outlet } from 'react-router-dom';
import { AccountHeader } from '../../components/Account/AccountHeader';
import { AccountMobileNav } from '../../components/Account/AccountMobileNav';
import { AccountSidebar } from '../../components/Account/AccountSidebar';
import './account.css';

export const AccountLayout = () => <div className="account-shell"><AccountHeader /><AccountMobileNav /><div className="account-layout"><AccountSidebar /><main className="account-main" id="main-content"><Outlet /></main></div></div>;
