import React from 'react';
import type { GoogleSheetSettingsStatus } from '../../../../types/googleSheetSettings';

interface Props { settings: GoogleSheetSettingsStatus | null; loading: boolean; }

export const GoogleSheetConnectionStatus: React.FC<Props> = ({ settings, loading }) => {
  if (loading && !settings) return <section className="google-sheet-settings-status" aria-busy="true">Đang tải trạng thái Google Sheet...</section>;
  if (!settings) return null;
  const statusLabel = settings.lastTestStatus === 'SUCCESS' ? 'Kết nối thành công' : settings.lastTestStatus === 'FAILED' ? 'Kết nối lỗi' : settings.source === 'NONE' ? 'Chưa cấu hình' : 'Chưa kiểm tra';
  return (
    <section className={`google-sheet-settings-status google-sheet-status-${settings.lastTestStatus.toLowerCase()}`}>
      <div className="google-sheet-status-heading"><span className="google-sheet-status-dot" aria-hidden="true" /> <strong>{statusLabel}</strong></div>
      <dl className="google-sheet-status-grid">
        <div><dt>Nguồn credential</dt><dd>{settings.source === 'ADMIN_SETTINGS' ? 'Admin Settings' : settings.source === 'ENVIRONMENT' ? 'Environment fallback' : 'Chưa cấu hình'}</dd></div>
        <div><dt>Credential</dt><dd>{settings.credentialMasked ?? 'Chưa có credential'}</dd></div>
        <div><dt>Fingerprint</dt><dd>{settings.credentialFingerprint ?? 'Chưa có'}</dd></div>
        <div><dt>Spreadsheet</dt><dd>{settings.spreadsheetIdMasked ?? 'Chưa có'}</dd></div>
        <div><dt>Sheet / range</dt><dd>{settings.sheetName && settings.range ? `${settings.sheetName} / ${settings.range}` : 'Chưa có'}</dd></div>
        <div><dt>Kiểm tra lần cuối</dt><dd>{settings.lastTestedAt ? new Date(settings.lastTestedAt).toLocaleString('vi-VN') : 'Chưa kiểm tra'}</dd></div>
      </dl>
      {settings.source === 'ENVIRONMENT' && <p className="google-sheet-settings-warning">Credential từ Environment vẫn hoạt động; thu hồi trong Admin không xóa secret Environment.</p>}
      {settings.lastTestErrorCode && <p className="google-sheet-settings-error-code">Mã lỗi: {settings.lastTestErrorCode}</p>}
    </section>
  );
};
