import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getReconciliationItems,
  getReconciliationSummary,
  runReconciliation,
  updateReconciliationItem,
} from '../../../services/reconciliationApi';
import type {
  ReconciliationFiltersState,
  ReconciliationItem,
  ReconciliationRunResult,
  ReconciliationSummary,
  ReconciliationUpdateRequest,
} from '../../../types/reconciliation';
import ReconciliationConfirmDialog from './ReconciliationConfirmDialog';
import ReconciliationDetailsDrawer from './ReconciliationDetailsDrawer';
import ReconciliationFilters from './ReconciliationFilters';
import {
  RECONCILIATION_RESOLUTION_LABELS,
  RECONCILIATION_STATUS_LABELS,
  getReconciliationStatusTone,
} from './reconciliationLabels';
import ReconciliationSummaryCards from './ReconciliationSummaryCards';

const EMPTY_SUMMARY: ReconciliationSummary = {
  total: 0,
  matched: 0,
  needsReview: 0,
  notFound: 0,
  missingWmproductId: 0,
  duplicateProviderOffer: 0,
  typeConflict: 0,
  legacyConflict: 0,
  conflicts: 0,
  inactiveProviderOffer: 0,
  confirmedByAdmin: 0,
  ignoredByAdmin: 0,
};

const PAGE_SIZE = 20;

const ReconciliationQueue = () => {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [filters, setFilters] = useState<ReconciliationFiltersState>({
    status: 'all',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [runResult, setRunResult] = useState<ReconciliationRunResult | null>(null);
  const [detailsItem, setDetailsItem] = useState<ReconciliationItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<ReconciliationItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getReconciliationSummary(controller.signal),
      getReconciliationItems({
        filters,
        page,
        pageSize: PAGE_SIZE,
        signal: controller.signal,
      }),
    ])
      .then(([nextSummary, response]) => {
        setSummary(nextSummary);
        setItems(response.items);
        setPage(response.page);
        setTotalPages(response.totalPages);
        setTotal(response.total);
        setError('');
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Không thể tải reconciliation.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters, page, refreshKey]);

  const handleRun = async () => {
    setRunning(true);
    setError('');

    try {
      const result = await runReconciliation();
      setRunResult(result);
      setSummary(result.summary);
      setPage(1);
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : 'Không thể chạy reconciliation.',
      );
    } finally {
      setRunning(false);
    }
  };

  const handleConfirm = async (request: ReconciliationUpdateRequest) => {
    if (!confirmItem) return;
    setSaving(true);
    setError('');

    try {
      await updateReconciliationItem(confirmItem.variantId, request);
      setConfirmItem(null);
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Không thể lưu xác nhận.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateFilters = (nextFilters: ReconciliationFiltersState) => {
    setLoading(true);
    setFilters(nextFilters);
    setPage(1);
  };

  return (
    <div className="reconciliation-queue">
      <div className="reconciliation-toolbar">
        <div>
          <strong>Hàng đợi đối chiếu</strong>
          <span>{total.toLocaleString('vi-VN')} record phù hợp</span>
        </div>
        <button
          type="button"
          className="reconciliation-run-button"
          onClick={() => void handleRun()}
          disabled={running}
        >
          <RefreshCw
            size={16}
            className={running ? 'provider-sync-icon-active' : undefined}
          />
          <span>{running ? 'Đang đối chiếu...' : 'Chạy đối chiếu'}</span>
        </button>
      </div>

      <ReconciliationSummaryCards summary={summary} />

      {runResult && (
        <div className="provider-sync-result" role="status">
          <strong>Đối chiếu hoàn tất</strong>
          <span>
            {runResult.created} mới, {runResult.updated} cập nhật,{' '}
            {runResult.unchanged} không đổi,{' '}
            {runResult.adminConfirmedPreserved} xác nhận Admin được giữ
          </span>
        </div>
      )}

      {error && (
        <div className="provider-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <ReconciliationFilters
        filters={filters}
        onChange={updateFilters}
      />

      {loading ? (
        <div className="provider-state" role="status">
          <LoaderCircle className="provider-loader" size={24} />
          <span>Đang tải hàng đợi reconciliation...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="provider-state provider-empty">
          <strong>Chưa có record phù hợp</strong>
          <span>Chạy đối chiếu hoặc thay đổi bộ lọc.</span>
        </div>
      ) : (
        <>
          <div className="provider-table-scroll">
            <table className="provider-table reconciliation-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>wmproductId</th>
                  <th>Kết quả</th>
                  <th>Gợi ý</th>
                  <th>Offer</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.variantId}>
                    <td className="reconciliation-product">
                      <strong>{item.productName}</strong>
                      <span>{item.productId}</span>
                    </td>
                    <td><code>{item.variantId}</code></td>
                    <td><code>{item.sku}</code></td>
                    <td><code>{item.wmproductId ?? 'Chưa có'}</code></td>
                    <td>
                      <span className={`reconciliation-status reconciliation-status-${getReconciliationStatusTone(item.status)}`}>
                        {RECONCILIATION_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td>
                      {item.confirmedResolution
                        ? RECONCILIATION_RESOLUTION_LABELS[item.confirmedResolution]
                        : item.suggestedResolution
                          ? RECONCILIATION_RESOLUTION_LABELS[item.suggestedResolution]
                          : 'Admin chọn'}
                    </td>
                    <td>
                      {item.providerOffers.length === 0
                        ? 'Không có'
                        : item.providerOffers.length === 1
                          ? item.providerOffers[0].providerProductName
                          : `${item.providerOffers.length} offer trùng`}
                    </td>
                    <td>
                      <div className="reconciliation-actions">
                        <button
                          type="button"
                          className="provider-icon-button"
                          onClick={() => setDetailsItem(item)}
                          aria-label={`Xem chi tiết ${item.sku}`}
                          title="Xem chi tiết"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="provider-icon-button"
                          onClick={() => setConfirmItem(item)}
                          aria-label={`Xác nhận ${item.sku}`}
                          title="Xác nhận phương án"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="provider-pagination">
            <span>Trang {page} / {totalPages}</span>
            <div>
              <button
                type="button"
                disabled={page === 1}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => Math.max(1, value - 1));
                }}
                aria-label="Trang reconciliation trước"
                title="Trang trước"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => Math.min(totalPages, value + 1));
                }}
                aria-label="Trang reconciliation sau"
                title="Trang sau"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {detailsItem && (
        <ReconciliationDetailsDrawer
          item={detailsItem}
          onClose={() => setDetailsItem(null)}
        />
      )}

      {confirmItem && (
        <ReconciliationConfirmDialog
          item={confirmItem}
          saving={saving}
          onClose={() => setConfirmItem(null)}
          onConfirm={(request) => void handleConfirm(request)}
        />
      )}
    </div>
  );
};

export default ReconciliationQueue;
