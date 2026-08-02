import { Link } from 'react-router-dom';
import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';
import { useCustomerDashboardSummary } from '../../hooks/customer/useCustomerDashboardSummary';
import { usePendingOrderRefresh } from '../../hooks/customer/usePendingOrderRefresh';
import { AccountErrorState } from '../../components/Account/AccountErrorState';
import { AccountLoadingState } from '../../components/Account/AccountLoadingState';
import { AccountSummaryCards } from '../../components/Account/AccountSummaryCards';
import { RecentOrders } from '../../components/Account/RecentOrders';

export const AccountOverviewPage = () => {
  const { data, error, loading, reload } = useCustomerDashboardSummary();
  usePendingOrderRefresh(Boolean(data?.orders.pending), reload);
  return <><SeoHead path="/tai-khoan" metadata={{ ...defaultMetadata(), title: 'Tai khoan | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Tong quan</p><h2>Quan ly don hang cua ban</h2><p className="account-lead">Theo doi don hang va trang thai xu ly tu mot noi.</p></div><Link className="account-button account-button-primary" to="/san-pham">Mua eSIM</Link></div>{loading && !data ? <AccountLoadingState /> : error && !data ? <AccountErrorState onRetry={() => void reload()} /> : data ? <><AccountSummaryCards summary={data} /><div className="account-overview-grid"><RecentOrders orders={data.recentOrders} /><section className="account-panel"><p className="account-kicker">Fulfillment</p><h2>Trang thai xu ly</h2><p className="account-big-number">{data.fulfillment.pendingOrders}</p><p className="account-muted">don hang dang cho xu ly</p><p className="account-muted">{data.fulfillment.pendingItems} san pham trong hang doi</p></section></div></> : null}</>;
};
