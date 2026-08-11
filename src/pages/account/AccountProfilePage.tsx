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
  if (loading && !data) return <><SeoHead path="/tai-khoan/ho-so" metadata={{ ...defaultMetadata(), title: 'Hồ sơ | HICO eSIM', indexable: false }} noindex /><AccountLoadingState /></>;
  if (error && !data) return <AccountErrorState onRetry={() => void reload()} />;
  if (!data) return null;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await save({ displayName: displayName || data.displayName }); setDisplayName(''); setMessage('Hồ sơ đã được cập nhật.'); } catch (value) { setMessage(value instanceof Error ? value.message : 'Không thể cập nhật hồ sơ.'); } finally { setBusy(false); } };
  const changeEmail = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await requestContactChange('email', email, csrfToken); setEmail(''); setMessage('Hãy mở email mới để xác minh thay đổi.'); } catch (value) { setMessage(value instanceof Error ? value.message : 'Không thể gửi yêu cầu.'); } finally { setBusy(false); } };
  return <><SeoHead path="/tai-khoan/ho-so" metadata={{ ...defaultMetadata(), title: 'Hồ sơ | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Hồ sơ</p><h2>Thông tin cá nhân</h2><p className="account-lead">Chỉ sửa thông tin hiển thị. Email và vai trò được bảo vệ riêng.</p></div></div>{message && <p className="account-feedback" role="status"><CheckCircle2 size={16} />{message}</p>}<div className="account-detail-grid"><form className="account-panel account-form" onSubmit={submit}><h3>Thông tin hiển thị</h3><label>Tên hiển thị<input value={displayName || data.displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={160} required /></label><label>Ngôn ngữ<input value={data.locale ?? ''} readOnly /></label><label>Múi giờ<input value={data.timezone ?? ''} readOnly /></label><button className="account-button account-button-primary" type="submit" disabled={busy}><Save size={16} /> Lưu thay đổi</button></form><div className="account-panel"><h3>Thông tin xác thực</h3><dl className="account-definition-list"><div><dt>Email</dt><dd>{data.email} {data.emailVerified && <span className="account-status-good">Đã xác minh</span>}</dd></div><div><dt>Điện thoại</dt><dd>{data.phone ?? 'Chưa cập nhật'}</dd></div></dl><form className="account-form" onSubmit={changeEmail}><label>Email mới<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className="account-button" type="submit" disabled={busy}><Send size={16} /> Gửi email xác minh</button></form></div></div></>;
};
