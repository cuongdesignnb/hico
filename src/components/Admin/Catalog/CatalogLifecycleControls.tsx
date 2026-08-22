import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { catalogLifecycleApi, CatalogLifecycleApiError } from '../../../services/catalogLifecycleApi';
import type { CatalogMaintenanceStatus, CatalogResetPreview } from '../../../types/catalogLifecycle';
import type { CatalogPreviewJob } from '../../../types/catalogPreviewJob';
import { useAdminToast } from '../../../hooks/useAdminToast';
import './CatalogLifecycleControls.css';

type Mode = 'reset' | 'full' | null;

const errorText = (error: unknown) => error instanceof CatalogLifecycleApiError ? `${error.message}${error.code ? ` (${error.code})` : ''}` : 'Không thể xử lý thao tác catalog.';
const maintenanceErrorText = (error: unknown) => error instanceof CatalogLifecycleApiError && error.code === 'CATALOG_MAINTENANCE_DISABLED'
  ? 'Chế độ bảo trì Catalog chưa được bật trên server.'
  : errorText(error);
const fullSyncErrorText = (error: unknown) => error instanceof CatalogLifecycleApiError && ['FULL_SYNC_EMPTY_CANDIDATE', 'FULL_SYNC_GROUPING_FAILED', 'FULL_SYNC_SOURCE_EMPTY'].includes(error.code)
  ? 'Không thể tạo catalog từ HICO GỐC: dữ liệu đọc được nhưng không tạo được sản phẩm.'
  : maintenanceErrorText(error);
const idempotencyKey = () => (globalThis.crypto?.randomUUID?.() ?? `catalog-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const CatalogLifecycleControls = ({ onChanged }: { onChanged?: () => void }) => {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useAdminToast();
  const [maintenanceStatus, setMaintenanceStatus] = useState<CatalogMaintenanceStatus | null>(null);
  const [resetPreview, setResetPreview] = useState<CatalogResetPreview | null>(null);
  const [fullJob, setFullJob] = useState<CatalogPreviewJob | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const loadMaintenanceStatus = useCallback(async () => {
    try { setMaintenanceStatus(await catalogLifecycleApi.maintenanceStatus()); } catch { setMaintenanceStatus(null); }
  }, []);

  useEffect(() => {
    let active = true;
    catalogLifecycleApi.maintenanceStatus()
      .then((status) => { if (active) setMaintenanceStatus(status); })
      .catch(() => { if (active) setMaintenanceStatus(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const previewJobId = fullJob?.id;
    const previewStatus = fullJob?.status;
    if (!previewJobId || !previewStatus || !['QUEUED', 'RUNNING'].includes(previewStatus)) return undefined;
    let active = true;
    const poll = () => catalogLifecycleApi.getPreviewJob(previewJobId)
      .then(({ job }) => { if (active) setFullJob(job); })
      .catch((pollError) => { if (active) setError(fullSyncErrorText(pollError)); });
    const timer = window.setInterval(poll, 1000);
    void poll();
    return () => { active = false; window.clearInterval(timer); };
  }, [fullJob?.id, fullJob?.status]);

  const openReset = async () => {
    setBusy(true); setError('');
    try { setResetPreview(await catalogLifecycleApi.resetPreview()); setMode('reset'); } catch (loadError) { toast.error(errorText(loadError)); }
    finally { setBusy(false); }
  };
  const openFull = async () => {
    setBusy(true); setError('');
    try { const result = await catalogLifecycleApi.startPreview('full'); setFullJob(result.job); setMode('full'); } catch (loadError) { toast.error(fullSyncErrorText(loadError)); }
    finally { setBusy(false); }
  };
  const cancelFull = async () => {
    if (!fullJob || !['QUEUED', 'RUNNING'].includes(fullJob.status)) return;
    setBusy(true);
    try { const result = await catalogLifecycleApi.cancelPreviewJob(fullJob.id); setFullJob(result.job); }
    catch (cancelError) { setError(fullSyncErrorText(cancelError)); }
    finally { setBusy(false); }
  };
  const close = () => { if (busy || previewRunning) return; setMode(null); setFullJob(null); setPassword(''); setConfirmation(''); setError(''); };
  const reset = async () => {
    if (!resetPreview?.currentVersionId) return;
    setBusy(true); setError('');
    try {
      await catalogLifecycleApi.reset({ catalogVersionId: resetPreview.currentVersionId, confirmation, currentPassword: password, idempotencyKey: idempotencyKey() });
      toast.success('Đã tạo catalog rỗng mới. Media và lịch sử vẫn được giữ lại.'); setBusy(false); close(); onChanged?.(); void loadMaintenanceStatus();
    } catch (resetError) { setError(maintenanceErrorText(resetError)); toast.error(maintenanceErrorText(resetError)); }
    finally { setBusy(false); }
  };
  const fullApply = async () => {
    const fullBatch = fullJob?.batch;
    if (!fullBatch || fullJob?.status !== 'SUCCEEDED') return;
    setBusy(true); setError('');
    try { await catalogLifecycleApi.fullApply(fullBatch.id, password); toast.success('Đã đồng bộ lại toàn bộ catalog từ HICO GỐC.'); setBusy(false); close(); onChanged?.(); void loadMaintenanceStatus(); }
    catch (applyError) { setError(fullSyncErrorText(applyError)); toast.error(fullSyncErrorText(applyError)); }
    finally { setBusy(false); }
  };
  const fullBatch = fullJob?.batch ?? null;
  const previewRunning = Boolean(fullJob && ['QUEUED', 'RUNNING'].includes(fullJob.status));
  const summary = fullBatch?.summary ?? {};
  const diagnostics = summary.diagnostics;
  const provider = summary.provider ?? diagnostics?.provider ?? {};
  const providerIssueCount = (provider.unresolved ?? 0) + (provider.ambiguous ?? 0) + (provider.inactive ?? 0);
  const candidateEmpty = (summary.products ?? 0) <= 0 || (summary.variants ?? 0) <= 0;
  return <>
    <div className={`catalog-maintenance-status ${maintenanceStatus?.enabled ? 'is-enabled' : 'is-disabled'}`} role="status">
      <strong>Catalog Maintenance: {maintenanceStatus ? (maintenanceStatus.enabled ? 'Đã bật' : 'Đang khóa') : 'Đang kiểm tra'}</strong>
      {maintenanceStatus?.enabled && <span>Chỉ sử dụng để Reset hoặc Full Sync HICO GỐC.</span>}
    </div>
    <div className="catalog-lifecycle-actions" aria-label="Thao tác toàn bộ catalog">
      <button type="button" className="catalog-secondary-button" onClick={() => void openFull()} disabled={busy || previewRunning}><RefreshCw size={16} /> Đồng bộ lại toàn bộ HICO GỐC</button>
      <button type="button" className="catalog-danger-button" onClick={() => void openReset()} disabled={busy}><Trash2 size={16} /> Xóa toàn bộ sản phẩm</button>
    </div>
    {error && !mode && <p className="catalog-lifecycle-error" role="alert">{error}</p>}
    {mode && <div className="catalog-lifecycle-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="catalog-lifecycle-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-lifecycle-title">
        <header><div><p className="catalog-lifecycle-eyebrow">CATALOG SAFETY</p><h2 id="catalog-lifecycle-title">{mode === 'reset' ? 'Xóa toàn bộ sản phẩm' : 'Đồng bộ lại toàn bộ HICO GỐC'}</h2></div><button type="button" className="catalog-lifecycle-close" onClick={close} aria-label="Đóng"><X size={20} /></button></header>
        {mode === 'reset' && resetPreview && <>
          <div className="catalog-lifecycle-warning"><AlertTriangle size={20} /><div><strong>Thao tác này chỉ tạo version catalog rỗng.</strong><span>Không xóa Media Library, order, eSIM, QR, payment hoặc catalog version cũ.</span></div></div>
          <div className="catalog-lifecycle-grid"><div><span>Hiện tại</span><strong>{resetPreview.products.toLocaleString('vi-VN')} Product · {resetPreview.variants.toLocaleString('vi-VN')} Variant</strong></div><div><span>Sau reset</span><strong>0 Product · 0 Variant</strong></div><div><span>Media sẽ giữ lại</span><strong>{resetPreview.linkedMedia.toLocaleString('vi-VN')} asset</strong></div><div><span>Version hiện tại</span><strong>{resetPreview.currentVersionId}</strong></div></div>
          <label className="catalog-lifecycle-field">Nhập đúng nội dung xác nhận<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={resetPreview.confirmation} autoComplete="off" /></label>
        </>}
        {mode === 'full' && fullJob && <>
          <div className="catalog-lifecycle-safe"><ShieldCheck size={20} /><span>Preview đang chạy tách khỏi HTTP backend: {fullJob.stage} · {fullJob.status}</span></div>
          {!fullBatch && previewRunning && <p className="catalog-lifecycle-message" role="status">Đang đọc và kiểm tra HICO GỐC. Bạn có thể hủy tác vụ này; backend vẫn tiếp tục phục vụ các API khác.</p>}
          {fullJob.status === 'FAILED' && <p className="catalog-lifecycle-error" role="alert">{fullJob.errorMessage} ({fullJob.errorCode})</p>}
          {fullJob.status === 'TIMED_OUT' && <p className="catalog-lifecycle-error" role="alert">Preview quá thời gian cho phép. Hãy thử lại.</p>}
          {fullJob.status === 'CANCELLED' && <p className="catalog-lifecycle-warning" role="status">Preview đã được hủy.</p>}
          {fullBatch && <>
          <div className="catalog-lifecycle-safe"><ShieldCheck size={20} /><span>Preview đã đọc tab HICO GỐC. Apply atomic, tạo draft/inactive và không xóa version cũ.</span></div>
          <div className="catalog-lifecycle-grid"><div><span>Nguồn</span><strong>{fullBatch.sheetTab}</strong></div><div><span>Logical range</span><strong>{diagnostics?.source?.range ?? fullBatch.sheetRange}</strong></div><div><span>Số batch</span><strong>{(diagnostics?.source?.batching?.batchCount ?? 1).toLocaleString('vi-VN')}</strong></div><div><span>Rows đã tải</span><strong>{(diagnostics?.source?.batching?.rowsFetched ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Rows đọc được</span><strong>{(diagnostics?.source?.rowsRead ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Rows đã parse</span><strong>{(diagnostics?.parser?.rowsParsed ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Physical branch</span><strong>{(diagnostics?.parser?.physicalBranches ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>eSIM branch</span><strong>{(diagnostics?.parser?.esimBranches ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Rows có cả hai nhánh</span><strong>{(diagnostics?.parser?.bothBranchRows ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Rows lỗi</span><strong>{(diagnostics?.parser?.rowsRejected ?? summary.invalid ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Package family</span><strong>{(diagnostics?.candidate?.packageFamilies ?? summary.packageFamilies ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Products mới</span><strong>{(summary.products ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Variants mới</span><strong>{(summary.variants ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Duplicate giống nhau đã gộp</span><strong>{(diagnostics?.candidate?.exactDuplicatesCollapsed ?? summary.exactDuplicatesCollapsed ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Collision bị chặn</span><strong>{(diagnostics?.candidate?.groupingCollisions ?? summary.groupingCollisions ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Nghiệp vụ cần xác nhận</span><strong>{(diagnostics?.candidate?.operationUnresolved ?? summary.operationUnresolved ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Ảnh giữ lại</span><strong>{(summary.imagesReused ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Ảnh từ Sheet</span><strong>{(summary.imagesFromSheet ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Ảnh fallback</span><strong>{(summary.imagesFallback ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Mô tả giữ lại</span><strong>{(summary.descriptionsReused ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Mô tả từ Sheet</span><strong>{(summary.descriptionsFromSheet ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Mô tả fallback</span><strong>{(summary.descriptionsFallback ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Hướng dẫn giữ lại</span><strong>{(summary.installationGuideReused ?? 0).toLocaleString('vi-VN')}</strong></div></div>
          {providerIssueCount > 0 && <div className="catalog-lifecycle-warning" role="alert"><AlertTriangle size={20} /><div><strong>{providerIssueCount.toLocaleString('vi-VN')} variant chưa sẵn sàng Provider.</strong><span>Candidate vẫn được tạo thành draft/inactive để Admin tiếp tục đối soát. Các variant này cần kiểm tra nguồn trước khi publish hoặc checkout.</span><span>Chưa match: {(provider.unresolved ?? 0).toLocaleString('vi-VN')} · Ambiguous: {(provider.ambiguous ?? 0).toLocaleString('vi-VN')} · Inactive: {(provider.inactive ?? 0).toLocaleString('vi-VN')}</span></div></div>}
          {diagnostics?.sizeDropWarning && <p className="catalog-lifecycle-warning" role="alert">Cảnh báo {diagnostics.sizeDropWarning.code}: candidate giảm mạnh so với catalog hiện tại ({diagnostics.sizeDropWarning.previousProducts} → {diagnostics.sizeDropWarning.candidateProducts} Product, {diagnostics.sizeDropWarning.previousVariants} → {diagnostics.sizeDropWarning.candidateVariants} Variant).</p>}
          {(summary.invalid ?? 0) > 0 && <p className="catalog-lifecycle-error">Full Sync bị chặn vì còn dòng lỗi. Hãy sửa mapping/provider rồi tạo preview mới.</p>}
          </>}
        </>}
        <label className="catalog-lifecycle-field">Mật khẩu Admin để xác nhận<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        {error && <p className="catalog-lifecycle-error" role="alert">{error}</p>}
        <footer><button type="button" className="catalog-secondary-button" onClick={previewRunning ? () => void cancelFull() : close} disabled={busy}>{previewRunning ? 'Hủy preview' : 'Hủy'}</button>{mode === 'reset' ? <button type="button" className="catalog-danger-button" onClick={() => void reset()} disabled={busy || confirmation !== resetPreview?.confirmation || !password}>Xác nhận xóa catalog</button> : <button type="button" className="catalog-primary-button" onClick={() => void fullApply()} disabled={busy || fullJob?.status !== 'SUCCEEDED' || !password || candidateEmpty || (summary.invalid ?? 0) > 0}>Xác nhận và rebuild</button>}</footer>
      </section>
    </div>}
  </>;
};
