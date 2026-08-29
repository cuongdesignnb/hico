import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  LoaderCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { getAdminCatalogProducts } from '../../../services/catalogApi';
import { getCatalogSourceStatus } from '../../../services/catalogWriteApi';
import { useBulkExecute } from '../../../hooks/catalog/useBulkExecute';
import { useBulkPreview } from '../../../hooks/catalog/useBulkPreview';
import { useBulkSelection } from '../../../hooks/catalog/useBulkSelection';
import { useCatalogQueues } from '../../../hooks/catalog/useCatalogQueues';
import type { BulkEntityType, BulkFilter, BulkOperation } from '../../../types/catalogBulk';
import type { CatalogProductRecord, CatalogStatus } from '../../../types/catalog';
import ProductTable from './ProductTable';
import ProductWizard from './ProductWizard/ProductWizard';
import ProductStatsCards from './ProductStatsCards';
import ProductFilters, {
  type CatalogFiltersState,
} from './ProductFilters';
import ProductOverviewPanel from './ProductOverviewPanel';
import ProductActivityFeed from './ProductActivityFeed';
import BulkActionBar, { type BulkOperationType } from './Bulk/BulkActionBar';
import BulkPreviewDialog from './Bulk/BulkPreviewDialog';
import BulkResultDialog from './Bulk/BulkResultDialog';
import BulkSelectionSummary from './Bulk/BulkSelectionSummary';
import InventoryWarningQueue from './Bulk/InventoryWarningQueue';
import NeedsReviewQueue from './Bulk/NeedsReviewQueue';
import ProviderIssueQueue from './Bulk/ProviderIssueQueue';
import SkuConflictQueue from './Bulk/SkuConflictQueue';
import './CatalogTab.css';

interface CatalogTabProps {
  searchQuery: string;
}

const PAGE_SIZE = 20;

const CatalogTab = ({ searchQuery }: CatalogTabProps) => {
  const [products, setProducts] = useState<CatalogProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [filters, setFilters] = useState<CatalogFiltersState>({
    operation: 'all',
    medium: 'all',
    supplier: 'all',
    coverage: 'all',
    status: 'all',
    quick: null,
  });
  const [page, setPage] = useState(1);
  const [wizard, setWizard] = useState<{ mode: 'create' | 'edit'; productId?: string } | null>(null);
  const [entityType, setEntityType] = useState<BulkEntityType>('product');
  const [bulkOperation, setBulkOperation] = useState<BulkOperationType>('PUBLISH');
  const [catalogVersionId, setCatalogVersionId] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [queueTab, setQueueTab] = useState<'sku' | 'review' | 'provider' | 'inventory'>('sku');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const bulkSelection = useBulkSelection();
  const bulkPreview = useBulkPreview();
  const bulkExecute = useBulkExecute();
  const queues = useCatalogQueues();

  // Sync local search with global search query
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with parent prop
    setLocalSearch(searchQuery);
    setPage(1);
  }, [searchQuery]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setProducts(await getAdminCatalogProducts());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh mục sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getAdminCatalogProducts(controller.signal)
      .then(setProducts)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh mục sản phẩm.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    getCatalogSourceStatus().then((status) => setCatalogVersionId(status.canonicalVersion ?? '')).catch(() => setCatalogVersionId(''));
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = localSearch.trim().toLocaleLowerCase('vi-VN');

    return products.filter((product) => {
      const matchesSearch = normalizedSearch === ''
        || product.name.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
        || product.id.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
        || product.variants.some((variant) => (
          variant.sku.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
          || variant.wmproductId?.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
        ));
      const matchesOperation = filters.operation === 'all' || product.operation === filters.operation;
      const matchesCoverage = filters.coverage === 'all' || product.coverageType === filters.coverage;
      const matchesMedium = filters.medium === 'all'
        || product.variants.some((variant) => variant.medium === filters.medium);
      const matchesSupplier = filters.supplier === 'all'
        || product.variants.some((variant) => variant.supplier === filters.supplier);
      const matchesStatus = filters.status === 'all' || product.status === filters.status;
      const matchesReview = filters.quick !== 'review' || product.variants.some((variant) => variant.needsReview);

      return matchesSearch
        && matchesOperation
        && matchesCoverage
        && matchesMedium
        && matchesSupplier
        && matchesStatus
        && matchesReview;
    });
  }, [filters, products, localSearch]);

  const totalVariants = useMemo(
    () => products.reduce((total, product) => total + product.variants.length, 0),
    [products],
  );
  const reviewCount = useMemo(
    () => products.reduce(
      (total, product) => total + product.variants.filter((variant) => variant.needsReview).length,
      0,
    ),
    [products],
  );
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((product) => product.id === selectedProductId) ?? null;
  }, [products, selectedProductId]);

  const handleFiltersChange = useCallback((next: CatalogFiltersState) => {
    setFilters(next);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    setPage(1);
    setSelectedProductId(null);
  }, []);

  const bulkFilter = useMemo<BulkFilter>(() => ({
    ...(localSearch.trim() ? { search: localSearch.trim() } : {}),
    ...(filters.operation !== 'all' ? { operation: filters.operation } : {}),
    ...(filters.medium !== 'all' ? { medium: filters.medium } : {}),
    ...(filters.supplier !== 'all' ? { supplier: filters.supplier } : {}),
    ...(filters.status !== 'all' ? { status: filters.status as CatalogStatus } : {}),
    ...(filters.quick === 'review' ? { needsReview: true } : {}),
  }), [filters, localSearch]);
  const openBulkPreview = () => {
    bulkPreview.clear();
    bulkExecute.clear();
    setBulkDialogOpen(true);
  };

  const runBulkPreview = (operationPayload: BulkOperation) => {
    if (!catalogVersionId) return;
    void bulkPreview.runPreview({ catalogVersionId, entityType, selection: bulkSelection.selection, operation: operationPayload }).catch(() => undefined);
  };

  const runBulkExecute = () => {
    if (!bulkPreview.preview) return;
    void bulkExecute.runExecute({ previewId: bulkPreview.preview.previewId, catalogVersionId: bulkPreview.preview.catalogVersionId, selectionHash: bulkPreview.preview.selectionHash, confirm: true }).then(() => {
      setBulkDialogOpen(false);
      bulkPreview.clear();
      bulkSelection.clear();
      void loadProducts();
      void queues.reload();
    }).catch(() => undefined);
  };

  const handleReload = () => {
    void loadProducts();
    void queues.reload();
  };

  if (loading) {
    return (
      <div className="catalog-state" role="status">
        <LoaderCircle className="catalog-spinner" size={24} />
        <span>Đang tải sản phẩm...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="catalog-state catalog-state-error" role="alert">
        <AlertCircle size={24} />
        <strong>{error}</strong>
        <button type="button" onClick={() => void loadProducts()}>Thử lại</button>
      </div>
    );
  }

  return (
    <>
    <section className="catalog-tab">
      <div className="catalog-tab__header">
        <div className="catalog-tab__header-info">
          <span className="catalog-tab__breadcrumb">Trang chủ / Sản phẩm</span>
          <h2>Quản lý sản phẩm</h2>
          <p>Quản lý và kiểm soát toàn bộ sản phẩm eSIM, SIM vật lý và thiết bị.</p>
        </div>
        <div className="catalog-tab__header-actions">
          <button type="button" className="catalog-primary-button" onClick={() => setWizard({ mode: 'create' })}>
            <Plus size={16} /> Thêm sản phẩm
          </button>
          <button
            type="button"
            className="catalog-icon-button"
            onClick={() => void handleReload()}
            aria-label="Làm mới danh mục"
            title="Làm mới"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      <div className="catalog-tab__summary" aria-label="Tổng quan danh mục">
        <div>
          <span>Sản phẩm</span>
          <strong>{products.length.toLocaleString('vi-VN')}</strong>
        </div>
        <div>
          <span>Gói bán</span>
          <strong>{totalVariants.toLocaleString('vi-VN')}</strong>
        </div>
        <div>
          <span>Cần xác nhận nguồn</span>
          <strong>{reviewCount.toLocaleString('vi-VN')}</strong>
        </div>
        <div>
          <span>Nguồn dữ liệu</span>
          <strong>Legacy adapter</strong>
        </div>
      </div>

      <ProductStatsCards products={products} />

      <ProductFilters
        searchQuery={localSearch}
        onSearchChange={handleSearchChange}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <BulkActionBar
        entityType={entityType}
        operation={bulkOperation}
        selectedCount={bulkSelection.selectedIds.length}
        isFilterSelection={bulkSelection.isFilterSelection}
        onEntityTypeChange={(value) => { bulkSelection.clear(); setEntityType(value); }}
        onOperationChange={setBulkOperation}
        onSelectFilter={() => bulkSelection.selectFilter(bulkFilter)}
        onClear={bulkSelection.clear}
        onPreview={openBulkPreview}
      />
      {(bulkSelection.selectedIds.length > 0 || bulkSelection.isFilterSelection) && <BulkSelectionSummary count={bulkSelection.selectedIds.length} isFilterSelection={bulkSelection.isFilterSelection} onClear={bulkSelection.clear} />}

      <div className="catalog-tab__split">
        <div className="catalog-tab__list">
          {visibleProducts.length > 0 ? (
            <>
              <ProductTable
                products={visibleProducts}
                onEdit={(productId) => setWizard({ mode: 'edit', productId })}
                entityType={entityType}
                selectedIds={bulkSelection.selectedIds}
                onTogglePage={bulkSelection.selectPage}
                selectedProductId={selectedProductId}
                onSelect={setSelectedProductId}
              />
              <div className="catalog-pagination">
                <span>
                  Hiển thị {(filteredProducts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1).toLocaleString('vi-VN')}
                  {' - '}
                  {Math.min(currentPage * PAGE_SIZE, filteredProducts.length).toLocaleString('vi-VN')}
                  {' trong tổng số '}
                  <strong>{filteredProducts.length.toLocaleString('vi-VN')}</strong>
                  {' sản phẩm'}
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={currentPage === 1}
                    aria-label="Trang trước"
                    title="Trang trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="catalog-pagination__page">
                    Trang <strong>{currentPage.toLocaleString('vi-VN')}</strong> / {totalPages.toLocaleString('vi-VN')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Trang sau"
                    title="Trang sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="catalog-empty">
              <strong>Không có sản phẩm phù hợp</strong>
              <span>Hãy đổi bộ lọc hoặc từ khóa tìm kiếm.</span>
              <button
                type="button"
                className="catalog-text-button"
                onClick={() => handleFiltersChange({
                  operation: 'all',
                  medium: 'all',
                  supplier: 'all',
                  coverage: 'all',
                  status: 'all',
                  quick: null,
                })}
              >
                Đặt lại bộ lọc
              </button>
            </div>
          )}
        </div>

        <div className={`catalog-tab__side${selectedProduct ? ' is-open' : ''}`}>
          {selectedProduct ? (
            <ProductOverviewPanel
              product={selectedProduct}
              onClose={() => setSelectedProductId(null)}
              onEdit={() => setWizard({ mode: 'edit', productId: selectedProduct.id })}
            />
          ) : (
            <div className="catalog-overview-placeholder" aria-live="polite">
              <Database size={28} />
              <strong>Chọn sản phẩm để xem chi tiết</strong>
              <span>Click vào một sản phẩm trong danh sách để mở panel preview.</span>
            </div>
          )}

          <ProductActivityFeed
            skuConflicts={queues.skuConflicts}
            needsReview={queues.needsReview}
            providerIssues={queues.providerIssues}
            inventoryWarnings={queues.inventoryWarnings}
            onTabChange={setQueueTab}
          />
        </div>
      </div>

      <section className="catalog-queues" aria-label="Hàng đợi xử lý catalog">
        <div className="catalog-queues-heading"><div><h3>Hàng đợi cần xử lý</h3><span>Chỉ cảnh báo để Admin kiểm tra, không tự sửa dữ liệu.</span></div><button type="button" className="catalog-icon-button" onClick={() => void queues.reload()} aria-label="Làm mới hàng đợi" title="Làm mới"><RefreshCw size={16} /></button></div>
        <div className="catalog-queue-tabs"><button type="button" className={queueTab === 'sku' ? 'is-active' : ''} onClick={() => setQueueTab('sku')}>SKU trùng <b>{queues.skuConflicts?.total ?? '—'}</b></button><button type="button" className={queueTab === 'review' ? 'is-active' : ''} onClick={() => setQueueTab('review')}>Cần review <b>{queues.needsReview?.total ?? '—'}</b></button><button type="button" className={queueTab === 'provider' ? 'is-active' : ''} onClick={() => setQueueTab('provider')}>Nguồn cấp <b>{queues.providerIssues?.total ?? '—'}</b></button><button type="button" className={queueTab === 'inventory' ? 'is-active' : ''} onClick={() => setQueueTab('inventory')}>Tồn kho <b>{queues.inventoryWarnings?.total ?? '—'}</b></button></div>
        {queueTab === 'sku' && <SkuConflictQueue data={queues.skuConflicts} />}
        {queueTab === 'review' && <NeedsReviewQueue data={queues.needsReview} />}
        {queueTab === 'provider' && <ProviderIssueQueue data={queues.providerIssues} />}
        {queueTab === 'inventory' && <InventoryWarningQueue data={queues.inventoryWarnings} />}
      </section>
    </section>
    {wizard && <ProductWizard mode={wizard.mode} productId={wizard.productId} onClose={() => setWizard(null)} onSaved={() => { setWizard(null); void loadProducts(); }} />}
    <BulkPreviewDialog key={`${bulkOperation}-${bulkDialogOpen}`} open={bulkDialogOpen} entityType={entityType} operationType={bulkOperation} selection={bulkSelection.selection} preview={bulkPreview.preview} previewLoading={bulkPreview.loading} previewError={bulkPreview.error} executeLoading={bulkExecute.loading} executeError={bulkExecute.error} onClose={() => setBulkDialogOpen(false)} onPreview={runBulkPreview} onExecute={runBulkExecute} />
    <BulkResultDialog result={bulkExecute.result} onClose={() => bulkExecute.clear()} />
    </>
  );
};

export default CatalogTab;
