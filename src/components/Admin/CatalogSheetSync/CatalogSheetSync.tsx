import { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { CatalogSheetSyncApiError, catalogSheetSyncApi } from '../../../services/catalogSheetSyncApi';
import type { CatalogPreviewJob, CatalogPreviewJobMode } from '../../../types/catalogPreviewJob';
import type { CatalogSheetSyncBatch, CatalogSheetSyncField, CatalogSheetSyncRow } from '../../../types/catalogSheetSync';
import { useAdminToast } from '../../../hooks/useAdminToast';
import './CatalogSheetSync.css';

const fields: Array<{ id: CatalogSheetSyncField; label: string }> = [{ id: 'price', label: 'Giá bán' }, { id: 'wmproductId', label: 'WM product ID' }, { id: 'apn', label: 'APN' }, { id: 'networkLabel', label: 'Mạng' }, { id: 'publicNote', label: 'Ghi chú public' }];
const terminal = (status: CatalogPreviewJob['status']) => ['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(status);
const displayError = (error: unknown, fallback: string) => error instanceof CatalogSheetSyncApiError && error.code === 'SHEET_SYNC_NOT_CONFIGURED' ? 'Chưa cấu hình Google Sheet.' : error instanceof Error ? error.message : fallback;

export const CatalogSheetSync = () => {
  const [job, setJob] = useState<CatalogPreviewJob | null>(null);
  const [batch, setBatch] = useState<CatalogSheetSyncBatch | null>(null);
  const [rows, setRows] = useState<CatalogSheetSyncRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<CatalogSheetSyncField[]>(fields.map((field) => field.id));
  const [quickMode, setQuickMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useAdminToast();
  const validRows = useMemo(() => rows.filter((row) => row.status === 'VALID'), [rows]);
  const previewRunning = Boolean(job && !terminal(job.status));

  const loadRows = async (batchId: string, nextPage = 1) => {
    const result = await catalogSheetSyncApi.listRows(batchId, nextPage, 100);
    setRows(result.items);
    setPage(result.page);
    setTotalRows(result.total);
    setSelectedRows(result.items.filter((row) => row.status === 'VALID').map((row) => row.id));
  };

  useEffect(() => {
    const previewJobId = job?.id;
    const previewStatus = job?.status;
    if (!previewJobId || !previewStatus || terminal(previewStatus)) return undefined;
    let active = true;
    const poll = () => catalogSheetSyncApi.getPreviewJob(previewJobId)
      .then(async ({ job: nextJob }) => {
        if (!active) return;
        setJob(nextJob);
        if (nextJob.status === 'SUCCEEDED' && nextJob.batch && !batch) {
          setBatch(nextJob.batch);
          try { await loadRows(nextJob.batch.id); toast.success('Đã tạo preview. Dữ liệu dòng được tải theo trang.'); }
          catch (loadError) { toast.error(displayError(loadError, 'Không thể tải các dòng preview.')); }
        }
        if (nextJob.status === 'FAILED' || nextJob.status === 'TIMED_OUT') toast.error(nextJob.errorMessage ?? 'Preview không hoàn tất.');
      })
      .catch((pollError) => { if (active) toast.error(displayError(pollError, 'Không thể theo dõi preview job.')); });
    const timer = window.setInterval(poll, 1000);
    void poll();
    return () => { active = false; window.clearInterval(timer); };
  }, [batch, job?.id, job?.status, toast]);

  const startPreview = async (mode: CatalogPreviewJobMode) => {
    setBusy(true);
    try {
      const result = await catalogSheetSyncApi.startPreview(mode);
      setJob(result.job); setBatch(null); setRows([]); setTotalRows(0); setPage(1); setSelectedRows([]); setQuickMode(mode === 'quick');
      toast.info('Preview đã được đưa vào hàng đợi và đang chạy tách khỏi HTTP backend.');
    } catch (error) { toast.error(displayError(error, 'Không thể khởi chạy preview.')); }
    finally { setBusy(false); }
  };
  const cancelPreview = async () => {
    if (!job || !previewRunning) return;
    setBusy(true);
    try { setJob((await catalogSheetSyncApi.cancelPreviewJob(job.id)).job); }
    catch (error) { toast.error(displayError(error, 'Không thể hủy preview.')); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!batch || !selectedRows.length) return;
    setBusy(true);
    try {
      const result = quickMode ? await catalogSheetSyncApi.quickApply(batch.id, selectedRows) : await catalogSheetSyncApi.apply(batch.id, { rowIds: selectedRows, fields: selectedFields });
      setBatch(result.batch); await loadRows(result.batch.id, page); toast.success(`Đã áp dụng ${selectedRows.length.toLocaleString('vi-VN')} dòng đồng bộ.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể áp dụng thay đổi.'); }
    finally { setBusy(false); }
  };
  const reject = async () => {
    if (!batch) return;
    setBusy(true);
    try { const result = await catalogSheetSyncApi.reject(batch.id); setBatch(result.batch); toast.info('Đã từ chối batch đồng bộ.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể từ chối batch.'); }
    finally { setBusy(false); }
  };
  const changePage = async (nextPage: number) => {
    if (!batch || nextPage < 1 || nextPage > Math.ceil(totalRows / 100)) return;
    setBusy(true);
    try { await loadRows(batch.id, nextPage); }
    catch (error) { toast.error(displayError(error, 'Không thể tải trang preview.')); }
    finally { setBusy(false); }
  };
  return <section className="sheet-sync-page">
    <header className="sheet-sync-header"><div><h2>Đồng bộ Google Sheet</h2><p>Chỉ đọc Sheet, xem trước thay đổi theo variant rồi phê duyệt thủ công.</p></div><div className="sheet-sync-header-actions"><button className="admin-btn-secondary" type="button" onClick={() => void startPreview('legacy')} disabled={busy || previewRunning}><RefreshCw size={16} /> Đọc Sheet cũ</button><button className="admin-btn-primary" type="button" onClick={() => void startPreview('quick')} disabled={busy || previewRunning}><RefreshCw size={16} /> Đồng bộ nhanh HICO GỐC</button></div></header>
    {job && <div className="sheet-sync-message" role="status">Preview job: {job.status} · {job.stage}{previewRunning && <button className="admin-btn-secondary" type="button" onClick={() => void cancelPreview()} disabled={busy}>Hủy preview</button>}{job.errorMessage && <span> · {job.errorMessage}</span>}</div>}
    {batch && <><div className="sheet-sync-summary"><span>Batch: {batch.id}</span><span>{batch.mode === 'quick' ? 'HICO GỐC' : 'Legacy'}</span><span>{batch.summary.valid ?? 0} hợp lệ</span><span>{batch.summary.invalid ?? 0} cần xử lý</span><span>Trạng thái: {batch.status}</span><span>Trang {page} / {Math.max(1, Math.ceil(totalRows / 100))}</span></div>{quickMode && <p className="sheet-sync-message">Preview chỉ cập nhật trường bán hàng đã map. Ảnh, mô tả, hướng dẫn cài đặt, SEO, slug, danh mục, publish, tồn kho và giá vốn không bị chạm.</p>}<div className="sheet-sync-controls"><label><input type="checkbox" checked={selectedRows.length === validRows.length && validRows.length > 0} onChange={(event) => setSelectedRows(event.target.checked ? validRows.map((row) => row.id) : [])} /> Chọn tất cả hợp lệ trên trang</label>{!quickMode && fields.map((field) => <label key={field.id}><input type="checkbox" checked={selectedFields.includes(field.id)} onChange={() => setSelectedFields((current) => current.includes(field.id) ? current.filter((id) => id !== field.id) : [...current, field.id])} /> {field.label}</label>)}</div><div className="sheet-sync-table-wrap"><table className="sheet-sync-table"><thead><tr><th></th><th>Dòng</th><th>Variant</th><th>Thay đổi</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><input type="checkbox" disabled={row.status !== 'VALID'} checked={selectedRows.includes(row.id)} onChange={() => setSelectedRows((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} /></td><td>{row.sourceRows?.join(', ') ?? row.sheetRowNumber}</td><td>{row.variantId ?? 'Không khớp'}</td><td>{Object.entries(row.diff).filter(([, change]) => change?.changed).map(([field, change]) => <div key={field}>{field}: {String(change?.before ?? 'trống')} → {String(change?.after ?? 'trống')}</div>)}</td><td>{row.status === 'INVALID' ? <><X size={14} /> {row.errors.map((error) => error.code).join(', ')}</> : <><Check size={14} /> {row.status}</>}</td></tr>)}</tbody></table></div><div className="sheet-sync-actions"><button className="admin-btn-secondary" type="button" onClick={() => void changePage(page - 1)} disabled={busy || page <= 1}>Trang trước</button><button className="admin-btn-secondary" type="button" onClick={() => void changePage(page + 1)} disabled={busy || page >= Math.ceil(totalRows / 100)}>Trang sau</button></div>{batch.status === 'READY_FOR_REVIEW' && <div className="sheet-sync-actions"><button className="admin-btn-secondary" type="button" onClick={() => void reject()} disabled={busy}>Từ chối batch</button><button className="admin-btn-primary" type="button" onClick={() => void apply()} disabled={busy || selectedRows.length === 0 || (!quickMode && selectedFields.length === 0)}>{quickMode ? 'Xác nhận và áp dụng đồng bộ nhanh' : 'Áp dụng các trường đã chọn'}</button></div>}</>}
  </section>;
};
