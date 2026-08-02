import { useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { BulkEntityType, BulkOperation, BulkPreviewResponse, BulkSelection } from '../../../../types/catalogBulk';
import type { BulkOperationType } from './BulkActionBar';
import BulkArchiveForm from './BulkArchiveForm';
import BulkExecuteDialog from './BulkExecuteDialog';
import BulkPriceForm from './BulkPriceForm';
import BulkProviderMappingForm from './BulkProviderMappingForm';
import BulkReadinessForm from './BulkReadinessForm';
import BulkStatusForm from './BulkStatusForm';

interface BulkPreviewDialogProps {
  open: boolean;
  entityType: BulkEntityType;
  operationType: BulkOperationType;
  selection: BulkSelection;
  preview: BulkPreviewResponse | null;
  previewLoading: boolean;
  previewError: Error | null;
  executeLoading: boolean;
  executeError: Error | null;
  onClose: () => void;
  onPreview: (operation: BulkOperation) => void;
  onExecute: () => void;
}

const BulkPreviewDialog = ({ open, entityType, operationType, selection, preview, previewLoading, previewError, executeLoading, executeError, onClose, onPreview, onExecute }: BulkPreviewDialogProps) => {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [currency, setCurrency] = useState<'VND' | 'USD'>('VND');
  const [providerOfferId, setProviderOfferId] = useState('');
  const [source, setSource] = useState<'hico_manual_qr' | 'hico_physical_stock' | 'manual_processing'>('hico_manual_qr');

  if (!open) return null;
  const operation = (): BulkOperation => {
    if (operationType === 'ADJUST_PRICE') return { type: operationType, mode, value: Number(value), currency };
    if (operationType === 'SET_PRICE' || operationType === 'SET_COMPARE_PRICE') return { type: operationType, value: Number(value), currency };
    if (operationType === 'CLEAR_COMPARE_PRICE') return { type: operationType, currency };
    if (operationType === 'SET_PROVIDER_MAPPING') return { type: operationType, providerOfferId };
    if (operationType === 'CLEAR_PROVIDER_MAPPING') return { type: operationType };
    if (operationType === 'SET_FULFILLMENT_SOURCE') return { type: operationType, source };
    return { type: operationType };
  };
  const needsInput = ['SET_PRICE', 'ADJUST_PRICE', 'SET_COMPARE_PRICE'].includes(operationType) && value === '';
  const productOnly = ['SET_FEATURED', 'UNSET_FEATURED'].includes(operationType);
  const variantOnly = ['ADJUST_PRICE', 'SET_PRICE', 'SET_COMPARE_PRICE', 'CLEAR_COMPARE_PRICE', 'SET_PROVIDER_MAPPING', 'CLEAR_PROVIDER_MAPPING', 'SET_FULFILLMENT_SOURCE'].includes(operationType);
  const canPreview = (productOnly && entityType === 'product') || (variantOnly && entityType === 'variant') || (!productOnly && !variantOnly);

  return (
    <div className="catalog-dialog-backdrop" role="presentation">
      <div className="catalog-dialog catalog-bulk-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-preview-title">
        <div className="catalog-dialog-heading"><div><CheckCircle2 size={20} /><h3 id="bulk-preview-title">Xem trước thay đổi</h3></div><button type="button" className="catalog-icon-button" onClick={onClose} aria-label="Đóng"><X size={16} /></button></div>
        <p className="catalog-dialog-subtitle">Kiểm tra toàn bộ selection ở máy chủ trước khi ghi một phiên bản catalog mới.</p>
        <div className="catalog-bulk-dialog-summary"><span>{selection.mode === 'filter' ? 'Theo bộ lọc' : `${selection.ids.length.toLocaleString('vi-VN')} mục`}</span><strong>{operationType === 'PUBLISH' ? 'Đưa lên bán' : operationType === 'UNPUBLISH' ? 'Tạm ngừng bán' : 'Thao tác danh mục'}</strong></div>
        {['ADJUST_PRICE', 'SET_PRICE', 'SET_COMPARE_PRICE', 'CLEAR_COMPARE_PRICE'].includes(operationType) && <BulkPriceForm operation={operationType as 'ADJUST_PRICE' | 'SET_PRICE' | 'SET_COMPARE_PRICE' | 'CLEAR_COMPARE_PRICE'} mode={mode} value={value} currency={currency} onModeChange={setMode} onValueChange={setValue} onCurrencyChange={setCurrency} />}
        {['SET_PROVIDER_MAPPING', 'CLEAR_PROVIDER_MAPPING'].includes(operationType) && <BulkProviderMappingForm clear={operationType === 'CLEAR_PROVIDER_MAPPING'} value={providerOfferId} onChange={setProviderOfferId} />}
        {operationType === 'SET_FULFILLMENT_SOURCE' && <label><span>Hình thức cấp</span><select value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="hico_manual_qr">QR thủ công của HICO</option><option value="hico_physical_stock">Tồn kho SIM vật lý HICO</option><option value="manual_processing">Xử lý thủ công</option></select></label>}
        {['ARCHIVE', 'RESTORE'].includes(operationType) && <BulkArchiveForm restore={operationType === 'RESTORE'} />}
        {['PUBLISH', 'UNPUBLISH', 'SET_FEATURED', 'UNSET_FEATURED', 'RUN_READINESS'].includes(operationType) && <BulkStatusForm operation={operationType} />}
        {operationType === 'RUN_READINESS' && <BulkReadinessForm />}
        {!canPreview && <p className="catalog-bulk-form-note">Thao tác này cần chọn đúng loại bản ghi.</p>}
        {previewError && <div className="catalog-dialog-error"><AlertCircle size={16} />{previewError.message}</div>}
        {executeError && <div className="catalog-dialog-error"><AlertCircle size={16} />{executeError.message}</div>}
        {preview && <div className="catalog-bulk-preview-result"><div><strong>{preview.eligible.toLocaleString('vi-VN')}</strong><span>có thể xử lý</span></div><div><strong>{preview.blocked.toLocaleString('vi-VN')}</strong><span>bị chặn</span></div><div><strong>{preview.warnings.length.toLocaleString('vi-VN')}</strong><span>cảnh báo</span></div></div>}
        {preview?.errors.length ? <div className="catalog-bulk-error-list"><strong>Một số mục bị chặn</strong>{preview.errors.slice(0, 5).map((item) => <span key={item.id}>{item.errors.map((error) => error.message).join('; ')}</span>)}</div> : null}
        <div className="catalog-dialog-actions"><button type="button" className="catalog-secondary-button" onClick={onClose}>Hủy</button><button type="button" className="catalog-secondary-button" disabled={previewLoading || needsInput || !canPreview} onClick={() => onPreview(operation())}>{previewLoading ? 'Đang kiểm tra...' : 'Tạo preview'}</button>{preview && preview.blocked === 0 && preview.eligible > 0 && <BulkExecuteDialog disabled={false} loading={executeLoading} onExecute={onExecute} />}</div>
        <span className="catalog-dialog-footnote">Preview có thời hạn ngắn; execute sẽ từ chối nếu dữ liệu đã thay đổi.</span>
      </div>
    </div>
  );
};

export default BulkPreviewDialog;
