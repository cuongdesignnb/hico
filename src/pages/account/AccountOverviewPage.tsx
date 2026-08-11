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
  return <><SeoHead path="/tai-khoan" metadata={{ ...defaultMetadata(), title: 'Tài khoản | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Tổng quan</p><h2>Quản lý đơn hàng của bạn</h2><p className="account-lead">Theo dõi đơn hàng và trạng thái xử lý từ một nơi.</p></div><Link className="account-button account-button-primary" to="/san-pham">Mua eSIM</Link></div>{loading && !data ? <AccountLoadingState /> : error && !data ? <AccountErrorState onRetry={() => void reload()} /> : data ? <><AccountSummaryCards summary={data} /><div className="account-overview-grid"><RecentOrders orders={data.recentOrders} /><section className="account-panel"><p className="account-kicker">Fulfillment</p><h2>Trạng thái xử lý</h2><p className="account-big-number">{data.fulfillment.pendingOrders}</p><p className="account-muted">đơn hàng đang chờ xử lý</p><p className="account-muted">{data.fulfillment.pendingItems} sản phẩm trong hàng đợi</p></section></div></> : null}</>;
};
