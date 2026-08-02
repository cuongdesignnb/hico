import type { BulkPreviewResponse } from '../../../../types/catalogBulk';

const ReadinessSummary = ({ preview }: { preview: BulkPreviewResponse | null }) => preview ? <div className="catalog-bulk-preview-result"><div><strong>{preview.eligible.toLocaleString('vi-VN')}</strong><span>đủ điều kiện</span></div><div><strong>{preview.blocked.toLocaleString('vi-VN')}</strong><span>bị chặn</span></div><div><strong>{preview.warnings.length.toLocaleString('vi-VN')}</strong><span>cảnh báo</span></div></div> : null;

export default ReadinessSummary;
