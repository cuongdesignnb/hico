import React, { useState } from 'react';
import { BookOpen, ChevronDown, ExternalLink, ShieldAlert } from 'lucide-react';

interface Props {
  defaultOpen?: boolean;
}

interface GuideStep {
  title: string;
  body: React.ReactNode;
}

const cloudConsoleUrl = 'https://console.cloud.google.com/';
const sheetsUrl = 'https://docs.google.com/spreadsheets/';

const externalLink = (href: string, label: string) => <a href={href} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={13} aria-hidden="true" /></a>;

const steps: GuideStep[] = [
  {
    title: 'Tạo hoặc chọn Google Cloud Project',
    body: <p>Mở {externalLink(cloudConsoleUrl, 'Google Cloud Console')} và tạo một Project mới hoặc chọn Project riêng cho HICO. Nên dùng Project riêng cho Catalog để dễ thu hồi quyền và theo dõi truy cập. Gợi ý tên: <strong>HICO Catalog Sheet Sync</strong>. HICO không khẳng định Google luôn miễn phí hoặc không cần billing.</p>,
  },
  {
    title: 'Bật Google Sheets API',
    body: <><p>Trong Google Cloud Console, mở <strong>APIs &amp; Services → Library</strong>, tìm <strong>Google Sheets API</strong> và chọn Enable.</p><label className="google-sheet-guide-check"><input type="checkbox" readOnly /> Google Sheets API đã được bật</label><p>Nếu sau này cần metadata Drive, chỉ bật Google Drive API với phạm vi tối thiểu. Hiện tại HICO chỉ cần Google Sheets read-only.</p></>,
  },
  {
    title: 'Tạo Service Account',
    body: <p>Mở <strong>IAM &amp; Admin → Service Accounts</strong> và chọn Create service account. Tên gợi ý: <strong>hico-catalog-sheet-reader</strong>. Mô tả: <em>Read-only access for HICO catalog reference Sheet</em>. Không cấp Owner hoặc Editor ở cấp Project. Hãy ghi lại email Service Account để chia sẻ Sheet ở bước 5.</p>,
  },
  {
    title: 'Tạo và tải khóa JSON',
    body: <><p>Mở Service Account vừa tạo → <strong>Keys → Add key → Create new key → JSON</strong>. Google sẽ tải một file JSON xuống máy.</p><div className="google-sheet-guide-warning" role="note"><ShieldAlert size={18} aria-hidden="true" /><span>File JSON chứa private key. Chỉ tải lên HICO qua form này. Không gửi qua email/chat, không đưa vào Google Sheet, Media Library, Git hoặc ticket. Nếu mất file hoặc nghi bị lộ, hãy tạo khóa mới và xóa khóa cũ.</span></div></>,
  },
  {
    title: 'Chia sẻ Google Sheet cho Service Account',
    body: <><p>Mở {externalLink(sheetsUrl, 'Google Sheet')} cần đồng bộ → Share → nhập email Service Account → chọn quyền <strong>Viewer</strong> → Save.</p><div className="google-sheet-guide-warning" role="note"><ShieldAlert size={18} aria-hidden="true" /><span>Chỉ dùng Viewer. Không dùng Editor, Owner hoặc Anyone with the link. Giữ Sheet ở chế độ Restricted và chỉ chia sẻ trực tiếp cho email Service Account.</span></div></>,
  },
  {
    title: 'Lấy Spreadsheet ID',
    body: <p>Spreadsheet ID là chuỗi nằm giữa <code>/d/</code> và <code>/edit</code> trong địa chỉ Google Sheet. Ví dụ an toàn: <code>https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit</code>. HICO chỉ cần lưu phần <code>SPREADSHEET_ID</code>, không cần lưu toàn bộ URL.</p>,
  },
  {
    title: 'Xác định tên Sheet và Range',
    body: <><p>Tên Sheet là tên tab ở phía dưới Google Sheet, ví dụ <code>HICO_SYNC</code>. Range có thể là <code>A1:K5000</code>.</p><ul><li>Header ở dòng đầu.</li><li>Một dòng tương ứng một variant.</li><li>Không dùng merged cell hoặc tên cột trùng nhau.</li><li>Không đổi tên cột sau khi đã cấu hình.</li><li>Chỉ đọc vùng dữ liệu cần thiết, không đọc toàn workbook.</li></ul></>,
  },
  {
    title: 'Cài đặt trong HICO',
    body: <ol><li>Tải file credential JSON lên form.</li><li>Nhập Spreadsheet ID.</li><li>Nhập tên Sheet và Range.</li><li>Chọn Test connection.</li><li>Khi kết nối thành công, chọn Lưu cấu hình.</li></ol>,
  },
  {
    title: 'Kiểm tra kết nối',
    body: <><p>Kết quả thành công chỉ hiển thị tiêu đề Spreadsheet, tên Sheet/range, header hợp lệ, số dòng mẫu và thời điểm kiểm tra. HICO không hiển thị private key, access token, full credential JSON hoặc raw row data.</p><p>Sau khi lưu, file input, textarea credential và trạng thái credential tạm thời sẽ được xóa. HICO không có chức năng xem lại private key.</p></>,
  },
];

const errorGuidance = [
  ['GOOGLE_SHEET_CREDENTIAL_INVALID', 'File JSON không hợp lệ hoặc không phải Service Account credential. Hãy tạo lại khóa JSON từ đúng Service Account.'],
  ['GOOGLE_SHEET_PERMISSION_DENIED', 'Sheet chưa được chia sẻ cho email Service Account hoặc quyền chưa là Viewer.'],
  ['GOOGLE_SHEET_NOT_FOUND', 'Không tìm thấy Spreadsheet ID. Kiểm tra chuỗi nằm giữa /d/ và /edit.'],
  ['GOOGLE_SHEET_RANGE_INVALID', 'Tên Sheet hoặc Range không tồn tại. Kiểm tra chính tả và định dạng A1, ví dụ A1:K5000.'],
  ['GOOGLE_SHEET_HEADER_INVALID', 'Header không đúng contract HICO. Kiểm tra tên cột và dòng header đã cấu hình.'],
  ['GOOGLE_SHEET_SECRET_DECRYPT_FAILED', 'Credential lưu trước đó không thể đọc. Tích hợp đã dừng an toàn; hãy thay credential mới hoặc liên hệ quản trị hệ thống.'],
  ['GOOGLE_SHEET_RATE_LIMITED', 'Google đang giới hạn số lần đọc. Chờ một lúc rồi thử lại, không cần tạo credential mới.'],
];

export const GoogleSheetCredentialGuide: React.FC<Props> = ({ defaultOpen = false }) => {
  const [openStep, setOpenStep] = useState(defaultOpen ? 1 : 0);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  return (
    <section className="google-sheet-guide" aria-labelledby="google-sheet-guide-title">
      <div className="google-sheet-guide-header">
        <div><p className="google-sheet-settings-eyebrow">Thiết lập an toàn</p><h3 id="google-sheet-guide-title">Bạn chưa có credential?</h3><p>Xem hướng dẫn tạo credential Google Sheet chỉ đọc ngay trong Cài đặt.</p></div>
        <BookOpen size={22} aria-hidden="true" />
      </div>
      <div className="google-sheet-guide-notice" role="note"><ShieldAlert size={18} aria-hidden="true" /><span>Chỉ dùng Service Account riêng cho HICO và chia sẻ Sheet với quyền Viewer. HICO không ghi ngược vào Google Sheet.</span></div>
      <div className="google-sheet-guide-steps">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isOpen = openStep === stepNumber;
          const panelId = `google-sheet-guide-step-${stepNumber}`;
          return <div className="google-sheet-guide-step" key={step.title}>
            <button type="button" className="google-sheet-guide-step-toggle" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenStep(isOpen ? 0 : stepNumber)}>
              <span className="google-sheet-guide-step-number">{stepNumber}</span><span>{step.title}</span><ChevronDown size={18} aria-hidden="true" className={isOpen ? 'is-open' : ''} />
            </button>
            {isOpen && <div id={panelId} className="google-sheet-guide-step-content">{step.body}</div>}
          </div>;
        })}
      </div>
      <div className="google-sheet-guide-subsection">
        <button type="button" className="google-sheet-guide-subsection-toggle" aria-expanded={showTroubleshooting} aria-controls="google-sheet-guide-troubleshooting" onClick={() => setShowTroubleshooting((value) => !value)}>
          <span>Xử lý lỗi theo mã</span><ChevronDown size={17} aria-hidden="true" className={showTroubleshooting ? 'is-open' : ''} />
        </button>
        {showTroubleshooting && <dl id="google-sheet-guide-troubleshooting" className="google-sheet-guide-errors">{errorGuidance.map(([code, guidance]) => <div key={code}><dt><code>{code}</code></dt><dd>{guidance}</dd></div>)}</dl>}
      </div>
    </section>
  );
};
