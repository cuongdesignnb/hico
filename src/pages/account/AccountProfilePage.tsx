import { useState } from 'react';
import { CheckCircle2, Save, Send } from 'lucide-react';
import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';
import { useCustomerAuth } from '../../auth/customer/useCustomerAuth';
import { requestContactChange } from '../../services/customerProfileApi';
import { useCustomerProfile } from '../../hooks/customer/useCustomerProfile';
import { AccountErrorState } from '../../components/Account/AccountErrorState';
import { AccountLoadingState } from '../../components/Account/AccountLoadingState';

export const AccountProfilePage = () => {
  const { csrfToken } = useCustomerAuth(); const { data, error, loading, reload, save } = useCustomerProfile(); const [displayName, setDisplayName] = useState(''); const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  if (loading && !data) return <><SeoHead path="/tai-khoan/ho-so" metadata={{ ...defaultMetadata(), title: 'Ho so | HICO eSIM', indexable: false }} noindex /><AccountLoadingState /></>;
  if (error && !data) return <AccountErrorState onRetry={() => void reload()} />;
  if (!data) return null;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await save({ displayName: displayName || data.displayName }); setDisplayName(''); setMessage('Ho so da duoc cap nhat.'); } catch (value) { setMessage(value instanceof Error ? value.message : 'Khong the cap nhat ho so.'); } finally { setBusy(false); } };
  const changeEmail = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await requestContactChange('email', email, csrfToken); setEmail(''); setMessage('Hay mo email moi de xac minh thay doi.'); } catch (value) { setMessage(value instanceof Error ? value.message : 'Khong the gui yeu cau.'); } finally { setBusy(false); } };
  return <><SeoHead path="/tai-khoan/ho-so" metadata={{ ...defaultMetadata(), title: 'Ho so | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Ho so</p><h2>Thong tin ca nhan</h2><p className="account-lead">Chi sua thong tin hien thi. Email va vai tro duoc bao ve rieng.</p></div></div>{message && <p className="account-feedback" role="status"><CheckCircle2 size={16} />{message}</p>}<div className="account-detail-grid"><form className="account-panel account-form" onSubmit={submit}><h3>Thong tin hien thi</h3><label>Ten hien thi<input value={displayName || data.displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={160} required /></label><label>Ngon ngu<input value={data.locale ?? ''} readOnly /></label><label>Mui gio<input value={data.timezone ?? ''} readOnly /></label><button className="account-button account-button-primary" type="submit" disabled={busy}><Save size={16} /> Luu thay doi</button></form><div className="account-panel"><h3>Thong tin xac thuc</h3><dl className="account-definition-list"><div><dt>Email</dt><dd>{data.email} {data.emailVerified && <span className="account-status-good">Da xac minh</span>}</dd></div><div><dt>Dien thoai</dt><dd>{data.phone ?? 'Chua cap nhat'}</dd></div></dl><form className="account-form" onSubmit={changeEmail}><label>Email moi<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className="account-button" type="submit" disabled={busy}><Send size={16} /> Gui email xac minh</button></form></div></div></>;
};
