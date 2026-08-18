import { CheckCircle2, TableProperties, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { executeCatalogImport, previewCatalogImport } from '../../../services/catalogImportApi';
import type { CatalogCategory } from '../../../types/catalog';
import type { CatalogImportColumnMap, CatalogImportPreview, CatalogImportSourceMode } from '../../../types/catalogImport';
import { useAdminToast } from '../../../hooks/useAdminToast';

interface CatalogImportDialogProps {
  categories: CatalogCategory[];
  initialCategoryId?: string;
  catalogVersionId: string;
  onClose: () => void;
  onComplete: () => void;
}

const semanticFields: Array<{ key: keyof CatalogImportColumnMap; label: string; required?: boolean }> = [
  { key: 'family', label: 'Họ gói / Product', required: true }, { key: 'productName', label: 'Tên Product' }, { key: 'sku', label: 'WMID / SKU', required: true }, { key: 'dataLimit', label: 'Dung lượng', required: true }, { key: 'duration', label: 'Thời hạn', required: true }, { key: 'price', label: 'Giá bán VND', required: true }, { key: 'compareAtPrice', label: 'Giá so sánh' }, { key: 'coverageType', label: 'Loại coverage' }, { key: 'coverageId', label: 'Mã coverage' },
];

const headersFrom = (text: string) => (text.split(/\r?\n/, 1)[0] ?? '').replace(/^\uFEFF/, '').split((text.split(/\r?\n/, 1)[0] ?? '').includes('\t') ? '\t' : ',').map((header) => header.trim().replace(/^"|"$/g, '')).filter(Boolean);
const guess = (headers: string[], patterns: RegExp[]) => headers.find((header) => patterns.some((pattern) => pattern.test(header.toLocaleLowerCase('vi-VN')))) ?? '';
const guessedMap = (headers: string[]): CatalogImportColumnMap => ({
  family: guess(headers, [/tên gói/, /goi/, /product name/, /sản phẩm/]),
  productName: guess(headers, [/tên gói/, /product name/, /sản phẩm/]),
  sku: guess(headers, [/wmid/, /wm id/, /mã.*gói/, /sku/]),
  dataLimit: guess(headers, [/dung lượng/, /data/]),
  duration: guess(headers, [/ngày/, /thời hạn/, /duration/]),
  price: guess(headers, [/giá bán/, /price/, /bán lẻ/]),
  compareAtPrice: guess(headers, [/giá.*so sánh/, /compare/]),
  coverageType: guess(headers, [/coverage type/, /loại vùng/]),
  coverageId: guess(headers, [/coverage id/, /quốc gia/, /vùng/]),
});

const CatalogImportDialog = ({ categories, initialCategoryId, catalogVersionId, onClose, onComplete }: CatalogImportDialogProps) => {
  const leaves = categories.filter((category) => category.parentId && category.status === 'active');
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? '');
  const [sourceMode, setSourceMode] = useState<CatalogImportSourceMode>('worldmove');
  const [text, setText] = useState('');
  const headers = useMemo(() => headersFrom(text), [text]);
  const [mapping, setMapping] = useState<CatalogImportColumnMap>({ family: '', sku: '', dataLimit: '', duration: '', price: '' });
  const [preview, setPreview] = useState<CatalogImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useAdminToast();
  const updateText = (value: string) => { setText(value); setMapping(guessedMap(headersFrom(value))); setPreview(null); };
  const runPreview = async () => { setLoading(true); setError(''); try { setPreview(await previewCatalogImport({ catalogVersionId, categoryId, sourceMode, text, columnMap: mapping })); toast.info('Đã tạo preview import. Hãy kiểm tra lỗi theo dòng trước khi xác nhận.'); } catch (cause) { const message = cause instanceof Error ? cause.message : 'Không thể preview import.'; setError(message); toast.error(message); } finally { setLoading(false); } };
  const execute = async () => { if (!preview) return; setLoading(true); setError(''); try { await executeCatalogImport({ previewId: preview.previewId, catalogVersionId: preview.catalogVersionId, confirm: true, idempotencyKey: `catalog-import-${preview.previewId}` }); toast.success('Đã xác nhận import catalog ở trạng thái draft.'); onComplete(); } catch (cause) { const message = cause instanceof Error ? cause.message : 'Không thể thực thi import.'; setError(message); toast.error(message); } finally { setLoading(false); } };
  const canPreview = Boolean(categoryId && text.trim() && semanticFields.filter((field) => field.required).every((field) => mapping[field.key]));

  return <div className="catalog-dialog-backdrop" role="presentation"><section className="catalog-dialog catalog-import-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-import-title">
    <div className="catalog-dialog-heading"><div><TableProperties size={18} /><h3 id="catalog-import-title">Nhập nhanh từ Sheet</h3></div><button type="button" className="catalog-icon-button" onClick={onClose} aria-label="Đóng"><X size={16} /></button></div>
    <p className="catalog-dialog-subtitle">Một lần dán có thể tạo nhiều Product family trong cùng danh mục. Tất cả được lưu draft/inactive.</p>
    {error && <div className="catalog-category-error" role="alert">{error}</div>}
    <div className="catalog-import-controls"><label><span>Danh mục con</span><select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPreview(null); }}><option value="">Chọn danh mục</option>{leaves.map((category) => <option value={category.id} key={category.id}>{category.path?.map((item) => item.name).join(' / ') || category.name}</option>)}</select></label><label><span>Nguồn áp dụng</span><select value={sourceMode} onChange={(event) => { setSourceMode(event.target.value as CatalogImportSourceMode); setPreview(null); }}><option value="worldmove">Worldmove exact WMID</option><option value="hico_manual_qr">QR riêng HICO</option><option value="hico_physical">Kho vật lý HICO</option><option value="manual_processing">Xử lý thủ công</option></select></label></div>
    <label className="catalog-import-paste"><span>Dán bảng có header</span><textarea rows={8} value={text} onChange={(event) => updateText(event.target.value)} placeholder="Dán trực tiếp các cột từ Google Sheet hoặc Excel" /></label>
    {headers.length > 0 && <div className="catalog-import-mapping">{semanticFields.map((field) => <label key={field.key}><span>{field.label}{field.required ? ' *' : ''}</span><select value={mapping[field.key] ?? ''} onChange={(event) => { setMapping((current) => ({ ...current, [field.key]: event.target.value || undefined })); setPreview(null); }}><option value="">Không map</option>{headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>)}</div>}
    {preview && <div className="catalog-import-preview"><div><strong>{preview.familyCount}</strong><span>Product family</span></div><div><strong>{preview.rowCount}</strong><span>Dòng dữ liệu</span></div><div><strong>{preview.blocked}</strong><span>Dòng bị chặn</span></div><div className="catalog-import-preview-hashes"><span>Catalog: {preview.catalogVersionId}</span><span>Provider: {preview.providerSnapshotHash.slice(0, 12)}</span></div><div className="catalog-import-family-list">{preview.families.map((family) => <span key={family.family}>{family.productName} · {family.variants} variants</span>)}</div>{preview.errors.map((item) => <p key={`${item.rowNumber}-${item.sku}`}>Dòng {item.rowNumber} · {item.sku}: {item.errors.join(', ')}</p>)}</div>}
    <div className="catalog-import-actions"><button type="button" className="catalog-secondary-button" disabled={loading || !canPreview} onClick={() => void runPreview()}>{loading ? 'Đang kiểm tra...' : 'Tạo preview'}</button><button type="button" className="catalog-primary-button" disabled={loading || !preview || preview.blocked > 0} onClick={() => void execute()}><CheckCircle2 size={15} /> Xác nhận import</button></div>
  </section></div>;
};

export default CatalogImportDialog;
