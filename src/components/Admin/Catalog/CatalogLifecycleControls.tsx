import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Eye, LoaderCircle, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { catalogLifecycleApi, CatalogLifecycleApiError } from '../../../services/catalogLifecycleApi';
import type { CatalogMaintenanceStatus, CatalogResetPreview } from '../../../types/catalogLifecycle';
import { CATALOG_PREVIEW_MODE_LABELS, CATALOG_PREVIEW_STAGE_LABELS, CATALOG_PREVIEW_STAGE_ORDER, formatCatalogPreviewElapsed, getCatalogPreviewStageIndex, isFullCatalogPreviewJob } from '../../../types/catalogPreviewJob';
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
  : error instanceof CatalogLifecycleApiError && error.code === 'CATALOG_PREVIEW_PERSIST_FAILED'
    ? 'Không thể lưu Preview vào kho dữ liệu.'
    : error instanceof CatalogLifecycleApiError && error.code === 'CATALOG_PREVIEW_STORAGE_TIMEOUT'
      ? 'Kho dữ liệu lưu Preview phản hồi quá chậm. Hãy thử lại.'
      : error instanceof CatalogLifecycleApiError && error.code === 'CATALOG_PREVIEW_STORAGE_CONFLICT'
        ? 'Kho dữ liệu từ chối Preview do xung đột dữ liệu. Hãy tạo Preview mới.'
  : maintenanceErrorText(error);
const idempotencyKey = () => (globalThis.crypto?.randomUUID?.() ?? `catalog-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const terminalPreviewStatuses = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT'] as const;
const activePreviewStatuses = ['QUEUED', 'RUNNING'] as const;
const categoryLabels: Record<string, string> = {
  'cat-esim-du-lich': 'eSIM du lịch', 'cat-sim-vat-ly': 'SIM vật lý',
  'cat-esim-san-goi': 'eSIM sẵn gói', 'cat-sim-vat-ly-san-goi': 'SIM vật lý sẵn gói',
  'cat-esim-co-goi': 'eSIM có gọi', 'cat-sim-vat-ly-co-goi': 'SIM vật lý có gọi',
  'cat-sim-viet-nam': 'SIM Việt Nam', 'cat-nap-them': 'Nạp thêm',
};

export const CatalogLifecycleControls = ({ onChanged }: { onChanged?: () => void }) => {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useAdminToast();
  const [maintenanceStatus, setMaintenanceStatus] = useState<CatalogMaintenanceStatus | null>(null);
  const [resetPreview, setResetPreview] = useState<CatalogResetPreview | null>(null);
  const [fullJob, setFullJob] = useState<CatalogPreviewJob | null>(null);
  const [conflictingPreview, setConflictingPreview] = useState<CatalogPreviewJob | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());

  const loadMaintenanceStatus = useCallback(async () => {
    try { setMaintenanceStatus(await catalogLifecycleApi.maintenanceStatus()); } catch { setMaintenanceStatus(null); }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.allSettled([catalogLifecycleApi.maintenanceStatus(), catalogLifecycleApi.getActivePreviewJob()])
      .then(([maintenanceResult, activeResult]) => {
        if (!active) return;
        if (maintenanceResult.status === 'fulfilled') setMaintenanceStatus(maintenanceResult.value);
        else setMaintenanceStatus(null);
        if (activeResult.status === 'fulfilled' && activeResult.value.job) {
          if (isFullCatalogPreviewJob(activeResult.value.job)) setFullJob(activeResult.value.job);
          else setConflictingPreview(activeResult.value.job);
        }
      });
    return () => { active = false; };
  }, []);

  const previewJobId = fullJob?.id;
  const previewStatus = fullJob?.status;
  const fullJobMode = fullJob?.mode;
  useEffect(() => {
    if (!previewJobId || !previewStatus || fullJobMode !== 'full' || !activePreviewStatuses.includes(previewStatus as typeof activePreviewStatuses[number])) return undefined;
    let active = true;
    const poll = () => catalogLifecycleApi.getPreviewJob(previewJobId)
      .then(({ job }) => { if (active) setFullJob(job); })
      .catch((pollError) => { if (active) setError(fullSyncErrorText(pollError)); });
    const timer = window.setInterval(poll, 1000);
    void poll();
    return () => { active = false; window.clearInterval(timer); };
  }, [fullJobMode, previewJobId, previewStatus]);

  useEffect(() => {
    if (!previewStatus || !activePreviewStatuses.includes(previewStatus as typeof activePreviewStatuses[number])) return undefined;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [previewJobId, previewStatus]);

  const conflictingPreviewId = conflictingPreview?.id;
  const conflictingPreviewMode = conflictingPreview?.mode;
  useEffect(() => {
    if (!conflictingPreviewId) return undefined;
    let active = true;
    const refresh = () => catalogLifecycleApi.getActivePreviewJob()
      .then(({ job }) => {
        if (!active) return;
        if (!job) {
          setConflictingPreview(null);
        } else if (isFullCatalogPreviewJob(job)) {
          setFullJob(job);
          setConflictingPreview(null);
        } else {
          setConflictingPreview(job);
        }
      })
      .catch(() => undefined);
    const timer = window.setInterval(refresh, 1500);
    return () => { active = false; window.clearInterval(timer); };
  }, [conflictingPreviewId, conflictingPreviewMode]);

  const openReset = async () => {
    setBusy(true); setError('');
    try { setResetPreview(await catalogLifecycleApi.resetPreview()); setMode('reset'); } catch (loadError) { toast.error(errorText(loadError)); }
    finally { setBusy(false); }
  };
  const openFull = async () => {
    setBusy(true); setError('');
    try {
      const result = await catalogLifecycleApi.startPreview('full');
      setFullJob(result.job); setConflictingPreview(null); setMode('full'); setPassword('');
    } catch (loadError) {
      if (loadError instanceof CatalogLifecycleApiError && loadError.code === 'CATALOG_PREVIEW_IN_PROGRESS') {
        const activeResult = await catalogLifecycleApi.getActivePreviewJob().catch(() => ({ job: null }));
        if (activeResult.job) {
          if (isFullCatalogPreviewJob(activeResult.job)) {
            setFullJob(activeResult.job); setConflictingPreview(null); setMode('full'); setPassword('');
            toast.success('Đã kết nối lại Preview toàn bộ Catalog đang chạy.');
          } else {
            setConflictingPreview(activeResult.job);
            toast.info(`${CATALOG_PREVIEW_MODE_LABELS[activeResult.job.mode]} đang chạy ở màn Đồng bộ Sheet. Hãy chờ hoặc hủy Preview đó trước khi chạy Full Preview.`);
          }
          setBusy(false);
          return;
        }
      }
      toast.error(fullSyncErrorText(loadError));
    }
    finally { setBusy(false); }
  };
  const cancelFull = async () => {
    if (!isFullCatalogPreviewJob(fullJob) || !activePreviewStatuses.includes(fullJob.status as typeof activePreviewStatuses[number])) return;
    setBusy(true);
    try { const result = await catalogLifecycleApi.cancelPreviewJob(fullJob.id); setFullJob(result.job); }
    catch (cancelError) { setError(fullSyncErrorText(cancelError)); }
    finally { setBusy(false); }
  };
  const close = () => { if (busy) return; setMode(null); setPassword(''); setConfirmation(''); setError(''); };
  const reset = async () => {
    if (!resetPreview?.currentVersionId) return;
    setBusy(true); setError('');
    try {
      await catalogLifecycleApi.reset({ catalogVersionId: resetPreview.currentVersionId, confirmation, currentPassword: password, idempotencyKey: idempotencyKey() });
      toast.success('Đã tạo catalog rỗng mới. Media và lịch sử vẫn được giữ lại.'); setBusy(false); close(); onChanged?.(); void loadMaintenanceStatus();
    } catch (resetError) { setError(maintenanceErrorText(resetError)); toast.error(maintenanceErrorText(resetError)); }
    finally { setBusy(false); }
  };
  const clearAppliedPreviewState = () => {
    setFullJob(null);
    setConflictingPreview(null);
    setPassword('');
    setConfirmation('');
    setError('');
    setMode(null);
  };
  const fullApply = async () => {
    const fullBatch = fullJob?.batch;
    if (!isFullCatalogPreviewJob(fullJob) || !fullBatch || fullBatch.mode !== 'full' || fullJob.status !== 'SUCCEEDED' || fullBatch.status !== 'READY_FOR_REVIEW') return;
    setBusy(true); setError('');
    try {
      await catalogLifecycleApi.fullApply(fullBatch.id, password);
      clearAppliedPreviewState();
      toast.success('Đã đồng bộ lại toàn bộ catalog từ HICO GỐC.');
      onChanged?.();
      void loadMaintenanceStatus();
    }
    catch (applyError) { setBusy(false); setError(fullSyncErrorText(applyError)); toast.error(fullSyncErrorText(applyError)); }
    finally { setBusy(false); }
  };
  const fullBatch = fullJob?.batch ?? null;
  const previewRunning = Boolean(fullJob && ['QUEUED', 'RUNNING'].includes(fullJob.status));
  const previewTerminal = Boolean(fullJob && terminalPreviewStatuses.includes(fullJob.status as typeof terminalPreviewStatuses[number]));
  const summary = fullBatch?.summary ?? {};
  const diagnostics = summary.diagnostics;
  const provider = summary.provider ?? diagnostics?.provider ?? {};
  const providerIssueCount = (provider.unresolved ?? 0) + (provider.ambiguous ?? 0) + (provider.inactive ?? 0);
  const operationIssueCount = Number(diagnostics?.candidate?.operationUnresolved ?? summary.operationUnresolved ?? 0);
  const candidateEmpty = (summary.products ?? 0) <= 0 || (summary.variants ?? 0) <= 0;
  const hasValidCatalogCandidate = Number(summary.valid ?? summary.validRows ?? summary.variants ?? 0) > 0;
  const previewStage = fullJob?.stage ?? 'STARTING';
  const previewElapsed = formatCatalogPreviewElapsed(fullJob?.startedAt ?? null, clockNow);
  const canApply = isFullCatalogPreviewJob(fullJob) && fullJob.status === 'SUCCEEDED' && fullBatch?.mode === 'full' && fullBatch.status === 'READY_FOR_REVIEW' && hasValidCatalogCandidate;
  const categoryCounts = summary.categoryCounts ?? diagnostics?.candidate?.categoryCounts ?? {};
  const mediumCounts = summary.mediums ?? diagnostics?.candidate?.mediums ?? {};
  const sourceTypeDiagnostics = diagnostics?.sourceAudit?.sourceTypeDiagnostics ?? {};
  const renderStageStepper = (className = '') => <ol className={`catalog-preview-stepper ${className}`.trim()} aria-label="Tiến trình Preview">
    {CATALOG_PREVIEW_STAGE_ORDER.map((stage, index) => {
      const currentIndex = getCatalogPreviewStageIndex(previewStage);
      const state = fullJob?.status === 'SUCCEEDED' || currentIndex > index ? 'done' : previewRunning && currentIndex === index ? 'active' : 'pending';
      return <li className={`is-${state}`} key={stage}><span className="catalog-preview-step-icon">{state === 'done' ? <CheckCircle2 size={14} /> : state === 'active' ? <LoaderCircle size={14} /> : <Circle size={12} />}</span><span>{CATALOG_PREVIEW_STAGE_LABELS[stage]}</span></li>;
    })}
  </ol>;
  return <>
    {fullJob && (previewRunning || previewTerminal) && <section className={`catalog-preview-banner is-${fullJob.status.toLowerCase()}`} role="status" aria-live="polite">
      <div className="catalog-preview-banner-heading"><div><p>{fullJob.status === 'SUCCEEDED' ? 'PREVIEW HICO GỐC HOÀN TẤT' : fullJob.status === 'FAILED' || fullJob.status === 'TIMED_OUT' ? 'PREVIEW HICO GỐC THẤT BẠI' : fullJob.status === 'CANCELLED' ? 'PREVIEW HICO GỐC ĐÃ HỦY' : 'ĐANG ĐỒNG BỘ HICO GỐC'}</p><strong>{CATALOG_PREVIEW_STAGE_LABELS[previewStage]}</strong><span>{CATALOG_PREVIEW_MODE_LABELS.full} · {fullJob.status}</span></div><time dateTime={fullJob.startedAt ?? undefined}>Đã chạy: {previewElapsed}</time></div>
      {fullJob.status === 'SUCCEEDED' && <div className="catalog-preview-banner-summary"><strong>{(summary.products ?? 0).toLocaleString('vi-VN')} Products</strong><strong>{(summary.variants ?? 0).toLocaleString('vi-VN')} Variants</strong></div>}
      {renderStageStepper()}
      <div className="catalog-preview-banner-actions"><button type="button" className="catalog-secondary-button" onClick={() => setMode('full')}><Eye size={16} /> {fullJob.status === 'SUCCEEDED' ? 'Xem kết quả Preview' : 'Xem chi tiết'}</button>{previewRunning && <button type="button" className="catalog-secondary-button" onClick={() => void cancelFull()} disabled={busy}><X size={16} /> Hủy Preview</button>}</div>
    </section>}
    <div className={`catalog-maintenance-status ${maintenanceStatus?.enabled ? 'is-enabled' : 'is-disabled'}`} role="status">
      <strong>Catalog Maintenance: {maintenanceStatus ? (maintenanceStatus.enabled ? 'Đã bật' : 'Đang khóa') : 'Đang kiểm tra'}</strong>
      {maintenanceStatus?.enabled && <span>Chỉ sử dụng cho thao tác bảo trì đã được phê duyệt.</span>}
    </div>
    {conflictingPreview && <p className="catalog-lifecycle-message" role="status">{CATALOG_PREVIEW_MODE_LABELS[conflictingPreview.mode]} đang chạy ở màn Đồng bộ Sheet. Hãy chờ hoặc hủy Preview đó trước khi chạy Full Preview.</p>}
    <div className="catalog-lifecycle-actions" aria-label="Thao tác toàn bộ catalog">
      <button type="button" className="catalog-secondary-button" onClick={() => { if (fullJob?.status === 'SUCCEEDED') setMode('full'); }} disabled={busy || previewRunning || Boolean(conflictingPreview) || !fullJob || fullJob.status !== 'SUCCEEDED'}><RefreshCw size={16} /> {fullJob?.status === 'SUCCEEDED' ? 'Xem Preview legacy' : 'HICO GỐC đã ngừng đồng bộ'}</button>
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
          <div className="catalog-lifecycle-safe"><ShieldCheck size={20} /><div><strong>{fullJob.status === 'SUCCEEDED' ? 'Preview hoàn tất' : fullJob.status === 'FAILED' || fullJob.status === 'TIMED_OUT' ? 'Preview thất bại' : 'Preview đang chạy'}</strong><span>{CATALOG_PREVIEW_STAGE_LABELS[previewStage]} · {fullJob.status} · Đã chạy {previewElapsed}</span></div></div>
          {previewRunning && renderStageStepper('catalog-preview-stepper-dialog')}
          {!fullBatch && previewRunning && <p className="catalog-lifecycle-message" role="status">Tác vụ đang chạy tách khỏi HTTP backend. Bạn có thể ẩn cửa sổ; tiến trình vẫn tiếp tục trên trang Catalog.</p>}
          {fullJob.status === 'FAILED' && <p className="catalog-lifecycle-error" role="alert"><strong>Bước:</strong> {CATALOG_PREVIEW_STAGE_LABELS[previewStage]}<br /><strong>Mã lỗi:</strong> {fullJob.errorCode}<br /><strong>Thông báo:</strong> {fullSyncErrorText(new CatalogLifecycleApiError(fullJob.errorMessage ?? 'Không thể hoàn tất preview catalog.', fullJob.errorCode ?? 'CATALOG_PREVIEW_FAILED'))}</p>}
          {fullJob.status === 'TIMED_OUT' && <p className="catalog-lifecycle-error" role="alert">Preview quá thời gian cho phép. Hãy thử lại.</p>}
          {fullJob.status === 'CANCELLED' && <p className="catalog-lifecycle-warning" role="status">Preview đã được hủy.</p>}
          {fullBatch && <>
          <div className="catalog-lifecycle-safe"><ShieldCheck size={20} /><span>Preview đã đọc tab HICO GỐC. Apply atomic, tạo draft/inactive và không xóa version cũ.</span></div>
           <p className="catalog-lifecycle-message" role="status">Thao tác này chỉ cập nhật dữ liệu HICO GỐC vào Catalog/Sản phẩm. Provider hoặc operation chưa sẵn sàng vẫn sẽ bị giữ ở trạng thái cần đối soát và chưa được phép checkout/fulfillment.</p>
          <div className="catalog-lifecycle-grid"><div><span>Nguồn</span><strong>{fullBatch.sheetTab}</strong></div><div><span>Logical range</span><strong>{diagnostics?.source?.range ?? fullBatch.sheetRange}</strong></div><div><span>Số batch</span><strong>{(diagnostics?.source?.batching?.batchCount ?? 1).toLocaleString('vi-VN')}</strong></div><div><span>Rows đã tải</span><strong>{(diagnostics?.source?.batching?.rowsFetched ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Rows đọc được</span><strong>{(diagnostics?.source?.rowsRead ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Rows đã parse</span><strong>{(diagnostics?.parser?.rowsParsed ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Physical branch</span><strong>{(diagnostics?.parser?.physicalBranches ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>eSIM branch</span><strong>{(diagnostics?.parser?.esimBranches ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Rows có cả hai nhánh</span><strong>{(diagnostics?.parser?.bothBranchRows ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Rows lỗi</span><strong>{(diagnostics?.parser?.rowsRejected ?? summary.invalid ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Package family</span><strong>{(diagnostics?.candidate?.packageFamilies ?? summary.packageFamilies ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Products mới</span><strong>{(summary.products ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Variants mới</span><strong>{(summary.variants ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>eSIM Variants</span><strong>{(mediumCounts.esim ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Physical SIM Variants</span><strong>{(mediumCounts.physical_sim ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Duplicate giống nhau đã gộp</span><strong>{(diagnostics?.candidate?.exactDuplicatesCollapsed ?? summary.exactDuplicatesCollapsed ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Collision bị chặn</span><strong>{(diagnostics?.candidate?.groupingCollisions ?? summary.groupingCollisions ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Nghiệp vụ cần xác nhận</span><strong>{(diagnostics?.candidate?.operationUnresolved ?? summary.operationUnresolved ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Ảnh giữ lại</span><strong>{(summary.imagesReused ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Ảnh từ Sheet</span><strong>{(summary.imagesFromSheet ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Ảnh fallback</span><strong>{(summary.imagesFallback ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Mô tả giữ lại</span><strong>{(summary.descriptionsReused ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Mô tả từ Sheet</span><strong>{(summary.descriptionsFromSheet ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Mô tả fallback</span><strong>{(summary.descriptionsFallback ?? 0).toLocaleString('vi-VN')}</strong></div><div><span>Hướng dẫn giữ lại</span><strong>{(summary.installationGuideReused ?? 0).toLocaleString('vi-VN')}</strong></div></div>
          <div className="catalog-lifecycle-diagnostics"><section><h3>Category</h3>{Object.entries(categoryCounts).map(([id, count]) => <div key={id}><span>{categoryLabels[id] ?? id}</span><strong>{Number(count).toLocaleString('vi-VN')}</strong></div>)}</section><section><h3>Source Type × Medium</h3>{Object.values(sourceTypeDiagnostics).map((source) => <div key={String(source.rawValue)}><span>{String(source.rawValue)}</span><strong>SIM {Number(source.physicalCompleteCount ?? 0).toLocaleString('vi-VN')} · eSIM {Number(source.esimCompleteCount ?? 0).toLocaleString('vi-VN')} · conflict {Number(source.sourceMediumConflictCount ?? 0).toLocaleString('vi-VN')}</strong></div>)}</section></div>
          {providerIssueCount > 0 && <div className="catalog-lifecycle-warning" role="alert"><AlertTriangle size={20} /><div><strong>{providerIssueCount.toLocaleString('vi-VN')} variant chưa sẵn sàng Provider.</strong><span>Bạn vẫn có thể cập nhật dữ liệu HICO GỐC vào Sản phẩm.</span><span>Các variant này chưa được phép bán/checkout/fulfillment cho đến khi Provider được đối soát.</span><span>Chưa match: {(provider.unresolved ?? 0).toLocaleString('vi-VN')} · Ambiguous: {(provider.ambiguous ?? 0).toLocaleString('vi-VN')} · Inactive: {(provider.inactive ?? 0).toLocaleString('vi-VN')}</span></div></div>}
          {operationIssueCount > 0 && <div className="catalog-lifecycle-warning" role="alert"><AlertTriangle size={20} /><div><strong>{operationIssueCount.toLocaleString('vi-VN')} variant chưa xác định operation chắc chắn.</strong><span>Dữ liệu vẫn có thể được lưu vào Catalog nhưng chưa đủ điều kiện checkout/fulfillment.</span></div></div>}
          {diagnostics?.sizeDropWarning && <p className="catalog-lifecycle-warning" role="alert">Cảnh báo {diagnostics.sizeDropWarning.code}: candidate giảm mạnh so với catalog hiện tại ({diagnostics.sizeDropWarning.previousProducts} → {diagnostics.sizeDropWarning.candidateProducts} Product, {diagnostics.sizeDropWarning.previousVariants} → {diagnostics.sizeDropWarning.candidateVariants} Variant).</p>}
          {(summary.invalid ?? 0) > 0 && <div className="catalog-lifecycle-warning" role="alert"><AlertTriangle size={20} /><div><strong>{(summary.invalid ?? 0).toLocaleString('vi-VN')} dòng invalid sẽ không được đưa vào Catalog.</strong><span>{(summary.valid ?? summary.validRows ?? 0).toLocaleString('vi-VN')} dòng hợp lệ vẫn có thể được cập nhật; các dòng lỗi tiếp tục được giữ lại để Admin review.</span></div></div>}
          </>}
        </>}
        {mode === 'reset' && <label className="catalog-lifecycle-field">Mật khẩu Admin để xác nhận<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>}
        {mode === 'full' && canApply && <label className="catalog-lifecycle-field">Mật khẩu Admin để xác nhận rebuild<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>}
        {error && <p className="catalog-lifecycle-error" role="alert">{error}</p>}
        <footer><button type="button" className="catalog-secondary-button" onClick={previewRunning ? () => void cancelFull() : close} disabled={busy}>{previewRunning ? 'Hủy preview' : 'Đóng'}</button>{mode === 'reset' ? <button type="button" className="catalog-danger-button" onClick={() => void reset()} disabled={busy || confirmation !== resetPreview?.confirmation || !password}>Xác nhận xóa catalog</button> : <>{['FAILED', 'TIMED_OUT', 'CANCELLED'].includes(fullJob?.status ?? '') && <button type="button" className="catalog-secondary-button" onClick={() => void openFull()} disabled={busy}><RefreshCw size={16} /> Thử lại</button>}{canApply && <button type="button" className="catalog-primary-button" onClick={() => void fullApply()} disabled={busy || !password || candidateEmpty}>Xác nhận cập nhật Catalog</button>}</>}</footer>
      </section>
    </div>}
  </>;
};
