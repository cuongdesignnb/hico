import React from 'react';

interface Props {
  credentialText: string;
  busy: boolean;
  configured: boolean;
  canRevoke: boolean;
  onCredentialChange: (value: string) => void;
  onFileChange: (file: File | undefined) => void;
  onReplace: () => void;
  onRevoke: () => void;
}

export const GoogleSheetCredentialForm: React.FC<Props> = ({ credentialText, busy, configured, canRevoke, onCredentialChange, onFileChange, onReplace, onRevoke }) => (
  <section className="google-sheet-settings-panel">
    <div className="google-sheet-panel-heading"><div><h3>Credential service account</h3><p>Credential chỉ được gửi HTTPS tới backend và không được lưu trong trình duyệt.</p></div></div>
    <div className="google-sheet-form-grid">
      <label className="google-sheet-field google-sheet-field-wide">Tải file JSON service account<input type="file" accept="application/json,.json" onChange={(event) => onFileChange(event.target.files?.[0])} /></label>
      <label className="google-sheet-field google-sheet-field-wide">Hoặc dán JSON tạm thời<textarea value={credentialText} onChange={(event) => onCredentialChange(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Dán JSON service account để kiểm tra và mã hóa server-side" rows={5} /></label>
      <p className="google-sheet-settings-hint google-sheet-field-wide">Credential được gửi trực tiếp tới backend qua HTTPS, được kiểm tra trước khi lưu và không được lưu trong trình duyệt. Chỉ Admin có quyền cấu hình tích hợp mới có thể thay đổi credential.</p>
    </div>
    <div className="google-sheet-action-row">
      <button type="button" className="admin-submit-btn" disabled={busy || !credentialText.trim()} onClick={onReplace}>{configured ? 'Kiểm tra và thay credential' : 'Kiểm tra và lưu credential'}</button>
      {canRevoke && <button type="button" className="admin-create-btn google-sheet-danger-button" disabled={busy} onClick={onRevoke}>Thu hồi credential</button>}
    </div>
    <p className="google-sheet-settings-hint">Không lưu filename, private key, token hoặc JSON thô trong Media Library, audit, Network response hay localStorage.</p>
  </section>
);
