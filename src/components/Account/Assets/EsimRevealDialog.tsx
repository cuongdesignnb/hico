import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Eye, LockKeyhole, X } from 'lucide-react';
import { useCustomerAuth } from '../../../auth/customer/useCustomerAuth';
import { revealEsim } from '../../../services/customerAssetsApi';
import type { CustomerAssetSecrets } from '../../../types/customerAsset';

export const EsimRevealDialog = ({ assetId, onClose }: { assetId: string; onClose: () => void }) => {
  const { csrfToken, reauth } = useCustomerAuth();
  const [secrets, setSecrets] = useState<CustomerAssetSecrets | null>(null);
  const [password, setPassword] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => () => setSecrets(null), []);
  const runReveal = async () => {
    setBusy(true); setError('');
    try { setSecrets(await revealEsim(assetId, csrfToken)); setNeedsReauth(false); setPassword(''); }
    catch (value) { const typed = value as { code?: string; message?: string }; if (typed.code === 'ESIM_REVEAL_REAUTH_REQUIRED') setNeedsReauth(true); else setError(typed.message ?? 'Không thể hiển thị thông tin.'); }
    finally { setBusy(false); }
  };
  const confirmReauth = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await reauth(password); await runReveal(); } catch (value) { setError((value as Error).message ?? 'Xác thực lại thất bại.'); setBusy(false); }
  };
  const copy = async (value: string | null | undefined) => { if (value) await navigator.clipboard?.writeText(value); };
  return <div className="account-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="esim-reveal-title">
    <div className="account-dialog-heading"><div><p className="account-kicker">Bảo mật</p><h2 id="esim-reveal-title">Hiển thị thông tin eSIM</h2></div><button className="account-icon-button" type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
    {!secrets && !needsReauth && <div className="account-dialog-content"><LockKeyhole size={30} /><p>Thông tin chi tiết chỉ hiển thị sau khi bạn xác nhận.</p><button className="account-button account-button-primary" type="button" onClick={() => void runReveal()} disabled={busy}><Eye size={17} />{busy ? 'Đang xác minh...' : 'Hiển thị'}</button></div>}
    {needsReauth && !secrets && <form className="account-dialog-content" onSubmit={(event) => void confirmReauth(event)}><LockKeyhole size={30} /><label htmlFor="reauth-password">Mật khẩu Customer</label><input id="reauth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button className="account-button account-button-primary" type="submit" disabled={busy}>{busy ? 'Đang xác minh...' : 'Xác nhận và hiển thị'}</button></form>}
    {error && <p className="account-dialog-error">{error}</p>}
    {secrets && <div className="account-secret-list">{Object.entries(secrets.fields).filter(([, value]) => value).map(([key, value]) => <div className="account-secret-row" key={key}><div><span>{key.toUpperCase()}</span><code>{value}</code></div><button className="account-icon-button" type="button" onClick={() => void copy(value)} aria-label={`Sao chép ${key}`}><Copy size={16} /></button></div>)}<p className="account-muted">Thông tin này không được lưu vào trình duyệt.</p></div>}
  </section></div>;
};
