import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';
import { AccountErrorState } from '../../components/Account/AccountErrorState';
import { AccountLoadingState } from '../../components/Account/AccountLoadingState';
import { NotificationList } from '../../components/Account/Notifications/NotificationList';
import { useCustomerNotifications } from '../../hooks/customer/useCustomerNotifications';

export const AccountNotificationsPage = () => {
  const { data, error, loading, reload, markRead, readAll } = useCustomerNotifications();
  return <><SeoHead path="/tai-khoan/thong-bao" metadata={{ ...defaultMetadata(), title: 'Thong bao | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Thong bao</p><h2>Thong bao cua ban</h2><p className="account-lead">Cac cap nhat duoc tao tu su kien that cua don hang va tai khoan.</p></div></div>{loading && !data ? <AccountLoadingState /> : error && !data ? <AccountErrorState onRetry={() => void reload()} /> : data ? <NotificationList items={data.items} onRead={markRead} onReadAll={readAll} /> : null}</>;
};
