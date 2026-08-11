import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';
import { ReferralPanel } from '../../components/Account/Referrals/ReferralPanel';

export const AccountReferralsPage = () => <><SeoHead path="/tai-khoan/gioi-thieu" metadata={{ ...defaultMetadata(), title: 'Giới thiệu | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Giới thiệu</p><h2>Kết nối cùng HICO</h2><p className="account-lead">Theo dõi quan hệ giới thiệu và trạng thái xử lý từ tài khoản của bạn.</p></div></div><ReferralPanel /></>;
