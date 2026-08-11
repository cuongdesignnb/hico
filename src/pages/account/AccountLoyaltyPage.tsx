import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';
import { useCustomerLoyalty } from '../../hooks/customer/useCustomerLoyalty';
import { useCustomerLoyaltyTransactions } from '../../hooks/customer/useCustomerLoyaltyTransactions';
import { AccountErrorState } from '../../components/Account/AccountErrorState';
import { AccountLoadingState } from '../../components/Account/AccountLoadingState';
import { AccountEmptyState } from '../../components/Account/AccountEmptyState';
import { LoyaltyBalanceCard } from '../../components/Account/Loyalty/LoyaltyBalanceCard';
import { LoyaltyRulesPanel } from '../../components/Account/Loyalty/LoyaltyRulesPanel';
import { LoyaltyTransactions } from '../../components/Account/Loyalty/LoyaltyTransactions';

export const AccountLoyaltyPage = () => {
  const { data, error, loading, reload } = useCustomerLoyalty();
  const [page, setPage] = useState(1);
  const transactions = useCustomerLoyaltyTransactions(page);
  const disabled = (error as (Error & { code?: string }) | null)?.code === 'LOYALTY_DISABLED';
  return <><SeoHead path="/tai-khoan/diem-thuong" metadata={{ ...defaultMetadata(), title: 'Điểm thưởng | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Điểm thưởng</p><h2>Theo dõi điểm của bạn</h2><p className="account-lead">Lịch sử điểm chỉ hiển thị khi hệ thống loyalty đã sẵn sàng.</p></div><Link className="account-button" to="/tai-khoan">Quay lại tổng quan</Link></div>{loading && !data ? <AccountLoadingState /> : disabled ? <AccountEmptyState label="Loyalty đang tạm thời chưa được kích hoạt." /> : error && !data ? <AccountErrorState onRetry={() => void reload()} /> : data ? <div className="account-loyalty-grid"><LoyaltyBalanceCard balance={data.balance} /><LoyaltyRulesPanel rules={data.rules} />{transactions.data && <LoyaltyTransactions data={transactions.data} onPage={setPage} loading={transactions.loading} />}</div> : null}</>;
};
