import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';
import { useCustomerLoyalty } from '../../hooks/customer/useCustomerLoyalty';
import { useCustomerLoyaltyTransactions } from '../../hooks/customer/useCustomerLoyaltyTransactions';
import { AccountErrorState } from '../../components/Account/AccountErrorState';
import { AccountLoadingState } from '../../components/Account/AccountLoadingState';
import { LoyaltyBalanceCard } from '../../components/Account/Loyalty/LoyaltyBalanceCard';
import { LoyaltyRulesPanel } from '../../components/Account/Loyalty/LoyaltyRulesPanel';
import { LoyaltyTransactions } from '../../components/Account/Loyalty/LoyaltyTransactions';

export const AccountLoyaltyPage = () => {
  const { data, error, loading, reload } = useCustomerLoyalty();
  const [page, setPage] = useState(1);
  const transactions = useCustomerLoyaltyTransactions(page);
  return <><SeoHead path="/tai-khoan/diem-thuong" metadata={{ ...defaultMetadata(), title: 'Diem thuong | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Diem thuong</p><h2>Theo doi diem cua ban</h2><p className="account-lead">Lich su diem chi hien thi khi he thong loyalty da san sang.</p></div><Link className="account-button" to="/tai-khoan">Quay lai tong quan</Link></div>{loading && !data ? <AccountLoadingState /> : error && !data ? <AccountErrorState onRetry={() => void reload()} /> : data ? <div className="account-loyalty-grid"><LoyaltyBalanceCard balance={data.balance} /><LoyaltyRulesPanel rules={data.rules} />{transactions.data && <LoyaltyTransactions data={transactions.data} onPage={setPage} loading={transactions.loading} />}</div> : null}</>;
};
