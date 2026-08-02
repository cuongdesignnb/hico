import { Check, Copy, Gift, Link2, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { applyReferralCode } from '../../../services/customerReferralApi';
import { useCustomerAuth } from '../../../auth/customer/useCustomerAuth';
import { useCustomerReferrals } from '../../../hooks/customer/useCustomerReferrals';

const statusLabel: Record<string, string> = {
  PENDING: 'Dang cho dieu kien',
  QUALIFIED: 'Da du dieu kien',
  REWARDED: 'Da ghi nhan',
  REVERSED: 'Da hoan',
  REJECTED: 'Da tu choi',
  MANUAL_REVIEW: 'Dang duoc xem xet',
};

export const ReferralPanel = () => {
  const { csrfToken } = useCustomerAuth();
  const { data, error, loading, reload } = useCustomerReferrals();
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (loading && !data) return <div className="account-state"><span className="account-spinner" />Dang tai gioi thieu...</div>;
  if (error && !data) return <div className="account-state account-error-state"><p>Gioi thieu chua san sang.</p><button type="button" className="account-button" onClick={() => void reload()}>Thu lai</button></div>;
  if (!data?.available) return <section className="account-panel"><Gift size={24} /><h2>Gioi thieu ban be</h2><p className="account-muted">Tinh nang gioi thieu chua duoc kich hoat.</p></section>;
  const copyCode = async () => { if (!data.code?.code) return; await navigator.clipboard?.writeText(data.code.code); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try { const result = await applyReferralCode(input, csrfToken); setMessage(result.status === 'MANUAL_REVIEW' ? 'Yeu cau dang duoc xem xet.' : 'Da tiep nhan ma gioi thieu.'); setInput(''); await reload(); } catch (value) { setMessage(value instanceof Error ? value.message : 'Khong the ap dung ma luc nay.'); } finally { setSubmitting(false); }
  };
  return <div className="account-referral-grid">
    <section className="account-panel">
      <div className="account-panel-heading"><div><p className="account-kicker">Gioi thieu</p><h2>Ma gioi thieu cua ban</h2></div><UsersRound size={24} /></div>
      <div className="account-referral-code"><strong>{data.code?.code ?? 'Chua co ma'}</strong><button type="button" className="account-icon-button" onClick={() => void copyCode()} aria-label="Sao chep ma gioi thieu" title="Sao chep ma gioi thieu">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
      {copied && <p className="account-muted">Da sao chep ma.</p>}
      <p className="account-muted">Chia se ma nay voi ban be. Dieu kien va trang thai se duoc cap nhat tu he thong.</p>
    </section>
    <section className="account-panel">
      <div className="account-panel-heading"><div><p className="account-kicker">Nhap ma</p><h2>Ap dung ma gioi thieu</h2></div><Link2 size={24} /></div>
      <form className="account-referral-form" onSubmit={(event) => void submit(event)}><label htmlFor="referral-code">Ma gioi thieu</label><input id="referral-code" value={input} onChange={(event) => setInput(event.target.value)} placeholder="HICO-XXXXXXXXXXXX" maxLength={17} autoComplete="off" /><button type="submit" className="account-button account-button-primary" disabled={submitting || !input.trim()}>{submitting ? 'Dang gui...' : 'Ap dung ma'}</button></form>
      {message && <p className="account-muted" role="status">{message}</p>}
    </section>
    <section className="account-panel account-referral-history"><div className="account-panel-heading"><div><p className="account-kicker">Lich su</p><h2>Quan he gioi thieu</h2></div></div>{data.relationships.length ? <div className="account-referral-list">{data.relationships.map((item) => <div className="account-referral-row" key={item.id}><div><strong>{item.role === 'REFERRER' ? 'Ban gioi thieu' : 'Ban duoc gioi thieu'}</strong><span>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span></div><span className="account-referral-status">{statusLabel[item.status] ?? item.status}</span></div>)}</div> : <p className="account-muted">Chua co quan he gioi thieu.</p>}</section>
  </div>;
};
