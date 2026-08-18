import { useEffect, useState } from 'react';
import { CreditCard, KeyRound, RefreshCw, Save } from 'lucide-react';
import { getSePaySettings, getSePayTransactions, replaceSePayCredential, saveSePaySettings } from '../../../services/sepayApi';
import type { SePaySettings, SePayTransaction } from '../../../types/sepay';
import { useAdminToast } from '../../../hooks/useAdminToast';
import './SePaySettingsPanel.css';

const initialForm = { enabled: false, bankAccountNumber: '', accountHolder: '', bankName: '', orderReferencePrefix: 'HICO' };

const SePaySettingsPanel = () => {
  const [settings, setSettings] = useState<SePaySettings | null>(null);
  const [transactions, setTransactions] = useState<SePayTransaction[]>([]);
  const [form, setForm] = useState(initialForm);
  const [secret, setSecret] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const toast = useAdminToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const next = await getSePaySettings();
      setSettings(next);
      setForm({ enabled: next.enabled, bankAccountNumber: '', accountHolder: next.accountHolder ?? '', bankName: next.bankName ?? '', orderReferencePrefix: next.orderReferencePrefix });
      setError('');
      await getSePayTransactions().then((result) => setTransactions(result.items)).catch(() => setTransactions([]));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Không thể tải cài đặt SePay.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try { const next = await saveSePaySettings({ ...form, version: settings?.version }); setSettings(next); toast.success('Đã lưu cài đặt SePay.'); }
    catch (value) { toast.error(value instanceof Error ? value.message : 'Không thể lưu cài đặt.'); }
    finally { setSaving(false); }
  };

  const saveSecret = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try { const next = await replaceSePayCredential({ secret, currentPassword, version: settings?.version }); setSettings(next); setSecret(''); setCurrentPassword(''); toast.success('Đã cập nhật secret. Secret không được hiển thị lại.'); }
    catch (value) { toast.error(value instanceof Error ? value.message : 'Không thể cập nhật secret.'); }
    finally { setSaving(false); }
  };

  if (loading) return <section className="sepay-panel" role="status"><RefreshCw className="sepay-spin" size={18} /> Đang tải cài đặt thanh toán...</section>;
  return <section className="sepay-panel">
    <div className="sepay-panel-heading"><div><p className="sepay-kicker">Tích hợp thanh toán</p><h2><CreditCard size={20} /> SePay</h2><p>Webhook chỉ nhận giao dịch VND, xác thực HMAC và đối soát mã đơn hàng chính xác.</p></div><button type="button" className="sepay-icon-button" onClick={() => void load()} aria-label="Làm mới cài đặt" title="Làm mới"><RefreshCw size={17} /></button></div>
    {error && <p className="sepay-feedback sepay-error" role="alert">{error}</p>}
    <form className="sepay-form" onSubmit={save}>
      <label className="sepay-toggle"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /><span>Kích hoạt nhận webhook SePay</span></label>
      <div className="sepay-grid"><label>Tên ngân hàng<input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></label><label>Chủ tài khoản<input value={form.accountHolder} onChange={(event) => setForm({ ...form, accountHolder: event.target.value })} /></label><label>Số tài khoản<input value={form.bankAccountNumber} onChange={(event) => setForm({ ...form, bankAccountNumber: event.target.value })} placeholder={settings?.bankAccountMasked ?? 'Nhập khi muốn thay đổi'} /></label><label>Prefix mã đơn hàng<input value={form.orderReferencePrefix} onChange={(event) => setForm({ ...form, orderReferencePrefix: event.target.value.toUpperCase() })} required /></label></div>
      <div className="sepay-form-actions"><button type="submit" className="sepay-button sepay-button-primary" disabled={saving}><Save size={16} /> Lưu cài đặt</button></div>
    </form>
    <form className="sepay-credential" onSubmit={saveSecret}><div><h3><KeyRound size={17} /> Secret HMAC</h3><p>Secret được mã hóa trong PostgreSQL. Không nhập credential vào frontend, env hoặc log.</p><strong>{settings?.credentialConfigured ? `Đã cấu hình ${settings.credentialMasked ?? ''}` : 'Chưa cấu hình'}</strong></div><label>Secret mới<input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="new-password" required /></label><label>Mật khẩu Admin để xác nhận<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label><button type="submit" className="sepay-button" disabled={saving}><KeyRound size={16} /> Cập nhật secret</button></form>
    <dl className="sepay-meta"><div><dt>Webhook URL</dt><dd>{settings?.webhookUrl}</dd></div><div><dt>Trạng thái</dt><dd>{settings?.status}</dd></div><div><dt>Fingerprint</dt><dd>{settings?.credentialFingerprint ?? 'Chưa có'}</dd></div></dl>
    <section className="sepay-transactions"><h3>Lịch sử giao dịch SePay</h3>{transactions.length === 0 ? <p>Chưa có giao dịch SePay được ghi nhận.</p> : <div className="sepay-transactions-scroll"><table><thead><tr><th>Mã giao dịch</th><th>Mã đơn</th><th>Số tiền</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td>{transaction.providerTransactionId}</td><td>{transaction.orderId ?? 'Manual Review'}</td><td>{transaction.amount.toLocaleString('vi-VN')} đ</td><td>{transaction.status}</td><td>{new Date(transaction.createdAt).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>}</section>
    <p className="sepay-note">Chưa chạy kết nối giao dịch thật và chưa phát sinh giao dịch SePay. Bản ghi mismatch sẽ vào Manual Review.</p>
  </section>;
};

export default SePaySettingsPanel;
