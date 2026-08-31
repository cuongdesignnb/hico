import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, RefreshCw, Settings2, ShieldCheck, TestTube2 } from 'lucide-react';
import { googleSheetSettingsApi, GoogleSheetSettingsApiError } from '../../../../services/googleSheetSettingsApi';
import type { GoogleSheetConnectionTestResult, GoogleSheetDiscoveryResult, GoogleSheetHeaderDiscoveryResult, GoogleSheetSettingsStatus } from '../../../../types/googleSheetSettings';
import { GoogleSheetConnectionStatus } from './GoogleSheetConnectionStatus';
import { GoogleSheetCredentialForm } from './GoogleSheetCredentialForm';
import { GoogleSheetTestResult } from './GoogleSheetTestResult';
import { GoogleSheetCredentialGuide } from './GoogleSheetCredentialGuide';
import './GoogleSheetSettings.css';

const errorText = (error: unknown) => error instanceof GoogleSheetSettingsApiError ? `${error.message}${error.code ? ` (${error.code})` : ''}` : 'Không thể xử lý tích hợp Google Sheet.';

export const GoogleSheetSettings: React.FC = () => {
  const [settings, setSettings] = useState<GoogleSheetSettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [credentialText, setCredentialText] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [range, setRange] = useState('A1:K5000');
  const [headerRow, setHeaderRow] = useState('1');
  const [enabled, setEnabled] = useState(false);
  const [testResult, setTestResult] = useState<GoogleSheetConnectionTestResult | null>(null);
  const [discovery, setDiscovery] = useState<GoogleSheetDiscoveryResult | null>(null);
  const [headerDiscovery, setHeaderDiscovery] = useState<GoogleSheetHeaderDiscoveryResult | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const next = await googleSheetSettingsApi.get();
      setSettings(next); setEnabled(next.enabled); setSheetName(next.sheetName ?? ''); setRange(next.range ?? 'A1:K5000'); setHeaderRow(String(next.headerRow ?? 1));
    } catch (loadError) { setError(errorText(loadError)); } finally { setLoading(false); }
  };
  useEffect(() => { queueMicrotask(() => { void load(); }); }, []);

  const saveSettings = async () => {
    setBusy(true); setMessage(''); setError('');
    try {
      const next = await googleSheetSettingsApi.save({ enabled, spreadsheetId: spreadsheetId.trim() || undefined, sheetName: sheetName.trim() || undefined, sheetRange: range.trim() || undefined, headerRow: Number(headerRow), referenceOnly: true, requireApproval: true, allowClearToken: true, scheduleEnabled: false });
      setSettings(next); setMessage('Đã lưu cấu hình kết nối.');
    } catch (saveError) { setError(errorText(saveError)); } finally { setBusy(false); }
  };
  const replaceCredential = async () => {
    if (!settings || !credentialText.trim()) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const result = await googleSheetSettingsApi.replaceCredential({ credential: credentialText, currentPassword, version: settings.version });
      setSettings(result.settings); setTestResult(result.test); setCredentialText(''); setCurrentPassword(''); setMessage('Credential đã được kiểm tra và lưu an toàn.');
    } catch (credentialError) { setError(errorText(credentialError)); } finally { setBusy(false); }
  };
  const testConnection = async () => {
    setBusy(true); setMessage(''); setError('');
    try { const result = await googleSheetSettingsApi.test({ spreadsheetId: spreadsheetId.trim(), sheetName: sheetName.trim(), sheetRange: range.trim(), headerRow: Number(headerRow) }); setSettings(result.settings); setTestResult(result); setMessage('Đã kiểm tra kết nối Google Sheet.'); }
    catch (testError) { setError(errorText(testError)); } finally { setBusy(false); }
  };
  const discoverSpreadsheet = async () => {
    if (!spreadsheetId.trim()) return;
    setBusy(true); setMessage(''); setError('');
    try { const result = await googleSheetSettingsApi.discover(spreadsheetId.trim()); setDiscovery(result); setHeaderDiscovery(null); setSheetName(result.sheets[0]?.title ?? ''); setMessage('Đã đọc thông tin spreadsheet và danh sách tab.'); }
    catch (discoverError) { setError(errorText(discoverError)); } finally { setBusy(false); }
  };
  const discoverHeader = async () => {
    const selected = discovery?.sheets.find((sheet) => sheet.title === sheetName);
    if (!selected || !spreadsheetId.trim()) return;
    setBusy(true); setMessage(''); setError('');
    try { const result = await googleSheetSettingsApi.discoverHeader({ spreadsheetId: spreadsheetId.trim(), sheetId: selected.sheetId, sheetTitle: selected.title, headerRow: Number(headerRow) }); setHeaderDiscovery(result); setRange(result.suggestedRange); setMessage('Đã đọc header. Hãy kiểm tra và xác nhận range trước khi lưu.'); }
    catch (headerError) { setError(errorText(headerError)); } finally { setBusy(false); }
  };
  const validateRange = async () => {
    if (!spreadsheetId.trim() || !sheetName.trim() || !range.trim()) return;
    setBusy(true); setMessage(''); setError('');
    try { await googleSheetSettingsApi.validateRange({ spreadsheetId: spreadsheetId.trim(), sheetTitle: sheetName.trim(), range: range.trim(), headerRow: Number(headerRow) }); setMessage('Range hợp lệ trong giới hạn đọc an toàn.'); }
    catch (rangeError) { setError(errorText(rangeError)); } finally { setBusy(false); }
  };
  const revokeCredential = async () => {
    if (!settings || !window.confirm('Thu hồi credential sẽ dừng Sheet Sync từ Admin Settings. Tiếp tục?')) return;
    setBusy(true); setMessage(''); setError('');
    try { const next = await googleSheetSettingsApi.revoke({ currentPassword, version: settings.version }); setSettings(next); setCurrentPassword(''); setMessage('Credential đã được thu hồi. Sheet Sync đã fail-closed.'); }
    catch (revokeError) { setError(errorText(revokeError)); } finally { setBusy(false); }
  };
  const preview = async () => {
    setBusy(true); setMessage(''); setError('');
    try { const result = await googleSheetSettingsApi.preview(); setMessage(`Preview batch ${result.batch.id} đã tạo: ${result.rows.length} dòng.`); }
    catch (previewError) { setError(errorText(previewError)); } finally { setBusy(false); }
  };

  return <section className="google-sheet-settings-shell">
    <div className="google-sheet-settings-header"><div><p className="google-sheet-settings-eyebrow">Cài đặt / Tích hợp</p><h2>Google Sheet Catalog</h2><p>Quản lý kết nối Sheet chỉ đọc cho Catalog Sync.</p></div><Settings2 size={24} aria-hidden="true" /></div>
    <GoogleSheetConnectionStatus settings={settings} loading={loading} />
    <GoogleSheetCredentialGuide defaultOpen={!settings?.credentialConfigured} />
    <div className="google-sheet-settings-panel">
      <div className="google-sheet-panel-heading"><div><h3><ShieldCheck size={18} /> Connection</h3><p>Canonical HICO vẫn là nguồn sự thật. Preview luôn cần Admin approval trước khi apply.</p></div></div>
      <div className="google-sheet-form-grid">
        <label className="google-sheet-toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span>Bật tích hợp Google Sheet</span></label>
        <label className="google-sheet-field">Spreadsheet ID<input value={spreadsheetId} onChange={(event) => setSpreadsheetId(event.target.value)} placeholder={settings?.spreadsheetIdMasked ?? 'Nhập Spreadsheet ID'} /></label>
        <label className="google-sheet-field">Tên sheet<input value={sheetName} onChange={(event) => setSheetName(event.target.value)} placeholder="HICO_SYNC" /></label>
        {discovery && <div className="google-sheet-discovery-result"><strong>{discovery.title ?? 'Spreadsheet'}</strong><span>{discovery.sheets.length} tab GRID · {discovery.timeZone ?? 'Không rõ múi giờ'}</span>{headerDiscovery && <span>Header: {headerDiscovery.headers.join(', ')} · Suggested: {headerDiscovery.suggestedRange}</span>}</div>}
        <label className="google-sheet-field">Range<input value={range} onChange={(event) => setRange(event.target.value)} placeholder="A1:K5000" /></label>
        <label className="google-sheet-field">Header row<input type="number" min="1" value={headerRow} onChange={(event) => setHeaderRow(event.target.value)} /></label>
        <div className="google-sheet-guardrails"><span><CheckCircle2 size={16} /> referenceOnly = true</span><span><CheckCircle2 size={16} /> requireApproval = true</span><span><KeyRound size={16} /> APN/LPA/PIN/PUK không bị ghi đè</span></div>
      </div>
      <div className="google-sheet-discovery-actions"><button type="button" className="admin-create-btn" disabled={busy || loading || !spreadsheetId.trim()} onClick={discoverSpreadsheet}>Đọc thông tin Sheet</button><button type="button" className="admin-create-btn" disabled={busy || loading || !discovery || !sheetName.trim()} onClick={discoverHeader}>Đọc header</button><button type="button" className="admin-create-btn" disabled={busy || loading || !headerDiscovery} onClick={validateRange}>Kiểm tra range</button></div>\r\n      <div className="google-sheet-action-row"><button type="button" className="admin-submit-btn" disabled={busy || loading} onClick={saveSettings}>Lưu cấu hình</button><button type="button" className="admin-create-btn" disabled={busy || loading || settings?.source === 'NONE'} onClick={testConnection}><TestTube2 size={16} /> Test connection</button><button type="button" className="admin-create-btn" disabled={busy || loading || settings?.source === 'NONE'} onClick={preview}><RefreshCw size={16} /> Chạy preview</button></div>
    </div>
    {settings && <GoogleSheetCredentialForm credentialText={credentialText} currentPassword={currentPassword} busy={busy} configured={settings.credentialConfigured} canRevoke={settings.source === 'ADMIN_SETTINGS' && settings.credentialConfigured} onCredentialChange={setCredentialText} onPasswordChange={setCurrentPassword} onFileChange={(file) => { if (file) void file.text().then(setCredentialText); }} onReplace={replaceCredential} onRevoke={revokeCredential} />}
    <GoogleSheetTestResult result={testResult} />
    {message && <p className="google-sheet-settings-message" role="status">{message}</p>}
    {error && <p className="google-sheet-settings-error" role="alert">{error}</p>}
  </section>;
};
