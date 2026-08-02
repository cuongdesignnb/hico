import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';
import { ReferralPanel } from '../../components/Account/Referrals/ReferralPanel';

export const AccountReferralsPage = () => <><SeoHead path="/tai-khoan/gioi-thieu" metadata={{ ...defaultMetadata(), title: 'Gioi thieu | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Gioi thieu</p><h2>Ket noi cung HICO</h2><p className="account-lead">Theo doi quan he gioi thieu va trang thai xu ly tu tai khoan cua ban.</p></div></div><ReferralPanel /></>;
