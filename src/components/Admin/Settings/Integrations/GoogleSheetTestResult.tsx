import React from 'react';
import type { GoogleSheetConnectionTestResult } from '../../../../types/googleSheetSettings';

export const GoogleSheetTestResult: React.FC<{ result: GoogleSheetConnectionTestResult | null }> = ({ result }) => {
  if (!result) return null;
  return (
    <section className="google-sheet-test-result" role="status">
      <strong>Kết nối thành công</strong>
      <dl className="google-sheet-test-grid">
        <div><dt>Spreadsheet</dt><dd>{result.spreadsheetTitle ?? 'Không có tiêu đề'}</dd></div>
        <div><dt>Sheet / range</dt><dd>{result.sheetName} / {result.range}</dd></div>
        <div><dt>Cột nhận diện</dt><dd>{result.headerColumns.join(', ')}</dd></div>
        <div><dt>Dòng mẫu</dt><dd>{result.rowsSampled}</dd></div>
      </dl>
    </section>
  );
};
