import { Check, Copy, Gift, Link2, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { applyReferralCode } from '../../../services/customerReferralApi';
import { useCustomerAuth } from '../../../auth/customer/useCustomerAuth';
import { useCustomerReferrals } from '../../../hooks/customer/useCustomerReferrals';
import { referralStatusLabels } from '../../../utils/customerStatusLabels';

export const ReferralPanel = () => {
  const { csrfToken } = useCustomerAuth();
  const { data, error, loading, reload } = useCustomerReferrals();
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (loading && !data) return <div className="account-state"><span className="account-spinner" />Đang tải giới thiệu...</div>;
  if (error && !data && (error as Error & { code?: string }).code === 'REFERRAL_DISABLED') return <section className="account-panel"><Gift size={24} /><h2>Giới thiệu bạn bè</h2><p className="account-muted">Tính năng giới thiệu chưa được kích hoạt.</p></section>;
  if (error && !data) return <div className="account-state account-error-state"><p>Giới thiệu chưa sẵn sàng.</p><button type="button" className="account-button" onClick={() => void reload()}>Thử lại</button></div>;
  if (!data?.available) return <section className="account-panel"><Gift size={24} /><h2>Giới thiệu bạn bè</h2><p className="account-muted">Tính năng giới thiệu chưa được kích hoạt.</p></section>;
  const copyCode = async () => { if (!data.code?.code) return; await navigator.clipboard?.writeText(data.code.code); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try { const result = await applyReferralCode(input, csrfToken); setMessage(result.status === 'MANUAL_REVIEW' ? 'Yêu cầu đang được xem xét.' : 'Đã tiếp nhận mã giới thiệu.'); setInput(''); await reload(); } catch (value) { setMessage(value instanceof Error ? value.message : 'Không thể áp dụng mã lúc này.'); } finally { setSubmitting(false); }
  };
  return <div className="account-referral-grid">
    <section className="account-panel">
      <div className="account-panel-heading"><div><p className="account-kicker">Giới thiệu</p><h2>Mã giới thiệu của bạn</h2></div><UsersRound size={24} /></div>
      <div className="account-referral-code"><strong>{data.code?.code ?? 'Chưa có mã'}</strong><button type="button" className="account-icon-button" onClick={() => void copyCode()} aria-label="Sao chép mã giới thiệu" title="Sao chép mã giới thiệu">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
      {copied && <p className="account-muted">Đã sao chép mã.</p>}
      <p className="account-muted">Chia sẻ mã này với bạn bè. Điều kiện và trạng thái sẽ được cập nhật từ hệ thống.</p>
    </section>
    <section className="account-panel">
      <div className="account-panel-heading"><div><p className="account-kicker">Nhap ma</p><h2>Ap dung ma gioi thieu</h2></div><Link2 size={24} /></div>
      <form className="account-referral-form" onSubmit={(event) => void submit(event)}><label htmlFor="referral-code">Mã giới thiệu</label><input id="referral-code" value={input} onChange={(event) => setInput(event.target.value)} placeholder="HICO-XXXXXXXXXXXX" maxLength={17} autoComplete="off" /><button type="submit" className="account-button account-button-primary" disabled={submitting || !input.trim()}>{submitting ? 'Đang gửi...' : 'Áp dụng mã'}</button></form>
      {message && <p className="account-muted" role="status">{message}</p>}
    </section>
    <section className="account-panel account-referral-history"><div className="account-panel-heading"><div><p className="account-kicker">Lịch sử</p><h2>Quan hệ giới thiệu</h2></div></div>{data.relationships.length ? <div className="account-referral-list">{data.relationships.map((item) => <div className="account-referral-row" key={item.id}><div><strong>{item.role === 'REFERRER' ? 'Bạn giới thiệu' : 'Bạn được giới thiệu'}</strong><span>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span></div><span className="account-referral-status">{referralStatusLabels[item.status] ?? item.status}</span></div>)}</div> : <p className="account-muted">Chưa có quan hệ giới thiệu.</p>}</section>
  </div>;
};
