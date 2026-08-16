import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  RefreshCw,
  TableProperties,
} from 'lucide-react';
import { getAdminCatalogProducts } from '../../../services/catalogApi';
import { getAdminCategories } from '../../../services/catalogWriteApi';
import { useBulkExecute } from '../../../hooks/catalog/useBulkExecute';
import { useBulkPreview } from '../../../hooks/catalog/useBulkPreview';
import { useBulkSelection } from '../../../hooks/catalog/useBulkSelection';
import { useCatalogQueues } from '../../../hooks/catalog/useCatalogQueues';
import type { BulkEntityType, BulkFilter, BulkOperation } from '../../../types/catalogBulk';
import type {
  CatalogAdminProductSummary,
  CatalogCategory,
  CoverageType,
  ProductOperation,
  SimMedium,
  Supplier,
} from '../../../types/catalog';
import ProductTable from './ProductTable';
import ProductWizard from './ProductWizard/ProductWizard';
import BulkActionBar, { type BulkOperationType } from './Bulk/BulkActionBar';
import BulkPreviewDialog from './Bulk/BulkPreviewDialog';
import BulkResultDialog from './Bulk/BulkResultDialog';
import BulkSelectionSummary from './Bulk/BulkSelectionSummary';
import InventoryWarningQueue from './Bulk/InventoryWarningQueue';
import NeedsReviewQueue from './Bulk/NeedsReviewQueue';
import ProviderIssueQueue from './Bulk/ProviderIssueQueue';
import SkuConflictQueue from './Bulk/SkuConflictQueue';
import './CatalogTab.css';
import CategorySidebar, { type CategorySelection } from './CategorySidebar';
import CategoryManagerDialog from './CategoryManagerDialog';
import CatalogImportDialog from './CatalogImportDialog';
import { CatalogLifecycleControls } from './CatalogLifecycleControls';

interface CatalogTabProps {
  searchQuery: string;
}

type OperationFilter = ProductOperation | 'all';
type CoverageFilter = CoverageType | 'all';
type MediumFilter = Exclude<SimMedium, null> | 'all';
type SupplierFilter = Supplier | 'all';

const PAGE_SIZE = 20;

const CatalogTab = ({ searchQuery }: CatalogTabProps) => {
  const [products, setProducts] = useState<CatalogAdminProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<OperationFilter>('all');
  const [coverage, setCoverage] = useState<CoverageFilter>('all');
  const [medium, setMedium] = useState<MediumFilter>('all');
  const [supplier, setSupplier] = useState<SupplierFilter>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ products: 0, variants: 0, needsReview: 0 });
  const [catalogVersionId, setCatalogVersionId] = useState('');
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [categorySelection, setCategorySelection] = useState<CategorySelection>('all');
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [wizard, setWizard] = useState<{ mode: 'create' | 'edit'; productId?: string; cloneProductId?: string; initialCategoryId?: string } | null>(null);
  const [entityType, setEntityType] = useState<BulkEntityType>('product');
  const [bulkOperation, setBulkOperation] = useState<BulkOperationType>('PUBLISH');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [queueTab, setQueueTab] = useState<'sku' | 'review' | 'provider' | 'inventory'>('sku');
  const bulkSelection = useBulkSelection();
  const bulkPreview = useBulkPreview();
  const bulkExecute = useBulkExecute();
  const queues = useCatalogQueues();

  const loadProducts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminCatalogProducts({
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        ...(operation !== 'all' ? { operation } : {}),
        ...(categorySelection !== 'all' && categorySelection !== 'unresolved' ? { category: categorySelection } : {}),
        ...(categorySelection === 'unresolved' ? { unresolved: true } : {}),
        ...(coverage !== 'all' ? { coverage } : {}),
        ...(medium !== 'all' ? { medium } : {}),
        ...(supplier !== 'all' ? { supplier } : {}),
        page,
        pageSize: PAGE_SIZE,
      }, signal);
      setProducts(response.items);
      setPagination(response.pagination);
      setSummary(response.summary);
      setCatalogVersionId(response.catalogVersionId ?? '');
    } catch (loadError) {
      if (!signal?.aborted) setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh mục sản phẩm.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [categorySelection, coverage, medium, operation, page, searchQuery, supplier]);

  const loadCategories = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await getAdminCategories(signal);
      setCategories(response.items);
      setUnresolvedCount(response.unresolvedCount);
      setCatalogVersionId(response.catalogVersionId);
    } catch (loadError) {
      if (!signal?.aborted) setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh mục.');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadProducts(controller.signal);
      if (!controller.signal.aborted) void loadCategories(controller.signal);
    });
    return () => controller.abort();
  }, [loadCategories, loadProducts]);

  const bulkFilter = useMemo<BulkFilter>(() => ({
    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
    ...(operation !== 'all' ? { operation } : {}),
    ...(medium !== 'all' ? { medium } : {}),
    ...(supplier !== 'all' ? { supplier } : {}),
  }), [medium, operation, searchQuery, supplier]);

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
    void bulkExecute.runExecute({
      previewId: bulkPreview.preview.previewId,
      catalogVersionId: bulkPreview.preview.catalogVersionId,
      selectionHash: bulkPreview.preview.selectionHash,
      confirm: true,
    }).then(() => {
      setBulkDialogOpen(false);
      bulkPreview.clear();
      bulkSelection.clear();
      void loadProducts();
      void queues.reload();
    }).catch(() => undefined);
  };

  const updateFilter = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  const selectedCategory = categories.find((category) => category.id === categorySelection);
  const selectedLeaf = selectedCategory?.parentId ? selectedCategory : undefined;

  if (loading) return <div className="catalog-state" role="status"><LoaderCircle className="catalog-spinner" size={24} /><span>Đang tải sản phẩm...</span></div>;

  if (error) return <div className="catalog-state catalog-state-error" role="alert"><AlertCircle size={24} /><strong>{error}</strong><button type="button" onClick={() => void loadProducts()}>Thử lại</button></div>;

  const currentPage = pagination.page;
  return (
    <>
      <section className="catalog-tab">
        <div className="catalog-heading-row">
          <div><h2>Danh mục sản phẩm</h2><p>{pagination.total.toLocaleString('vi-VN')} sản phẩm phù hợp</p></div>
          <div className="catalog-heading-actions">
            <button type="button" className="catalog-secondary-button" onClick={() => setImportOpen(true)}><TableProperties size={16} /> Nhập nhanh từ Sheet</button>
            <button type="button" className="catalog-secondary-button" disabled={Boolean(selectedCategory && !selectedLeaf)} title={selectedCategory && !selectedLeaf ? 'Hãy chọn một danh mục con' : undefined} onClick={() => setWizard({ mode: 'create', initialCategoryId: selectedLeaf?.id })}><Plus size={16} /> Tạo sản phẩm</button>
            <CatalogLifecycleControls onChanged={() => { void loadProducts(); void loadCategories(); }} />
            <button type="button" className="catalog-icon-button" onClick={() => void loadProducts()} aria-label="Làm mới danh mục" title="Làm mới"><RefreshCw size={17} /></button>
          </div>
        </div>

        <div className="catalog-workspace">
          <CategorySidebar categories={categories} selected={categorySelection} unresolvedCount={unresolvedCount} onSelect={(value) => { setCategorySelection(value); setPage(1); bulkSelection.clear(); }} onManage={() => setCategoryManagerOpen(true)} />
          <div className="catalog-product-workspace">

        <div className="catalog-summary" aria-label="Tổng quan danh mục">
          <div><span>Sản phẩm</span><strong>{summary.products.toLocaleString('vi-VN')}</strong></div>
          <div><span>Gói bán</span><strong>{summary.variants.toLocaleString('vi-VN')}</strong></div>
          <div><span>Cần xác nhận nguồn</span><strong>{summary.needsReview.toLocaleString('vi-VN')}</strong></div>
          <div><span>Nguồn dữ liệu</span><strong>Canonical</strong></div>
        </div>

        <BulkActionBar entityType={entityType} operation={bulkOperation} selectedCount={bulkSelection.selectedIds.length} isFilterSelection={bulkSelection.isFilterSelection} onEntityTypeChange={(value) => { bulkSelection.clear(); setEntityType(value); }} onOperationChange={setBulkOperation} onSelectFilter={() => bulkSelection.selectFilter(bulkFilter)} onClear={bulkSelection.clear} onPreview={openBulkPreview} />
        {(bulkSelection.selectedIds.length > 0 || bulkSelection.isFilterSelection) && <BulkSelectionSummary count={bulkSelection.selectedIds.length} isFilterSelection={bulkSelection.isFilterSelection} onClear={bulkSelection.clear} />}

        <div className="catalog-filters">
          <label><span>Nghiệp vụ</span><select value={operation} onChange={(event) => updateFilter(setOperation, event.target.value as OperationFilter)}><option value="all">Tất cả</option><option value="new_subscription">Mua SIM mới</option><option value="topup">Top-up</option><option value="device_sale">Thiết bị</option></select></label>
          <label><span>Hình thức</span><select value={medium} onChange={(event) => updateFilter(setMedium, event.target.value as MediumFilter)}><option value="all">Tất cả</option><option value="esim">eSIM</option><option value="physical_sim">SIM vật lý</option></select></label>
          <label><span>Nguồn cấp</span><select value={supplier} onChange={(event) => updateFilter(setSupplier, event.target.value as SupplierFilter)}><option value="all">Tất cả</option><option value="worldmove">Worldmove</option><option value="local_carrier">Nhà mạng địa phương</option><option value="hico">HICO</option><option value="other">Chưa xác nhận</option></select></label>
          <label><span>Vùng phủ</span><select value={coverage} onChange={(event) => updateFilter(setCoverage, event.target.value as CoverageFilter)}><option value="all">Tất cả</option><option value="country">Một quốc gia</option><option value="region">Khu vực</option><option value="global">Toàn cầu</option><option value="not_applicable">Không áp dụng</option></select></label>
        </div>

        {products.length > 0 ? <>
          <ProductTable products={products} onEdit={(productId) => setWizard({ mode: 'edit', productId })} onClone={(cloneProductId) => setWizard({ mode: 'create', cloneProductId })} entityType={entityType} selectedIds={bulkSelection.selectedIds} onTogglePage={bulkSelection.selectPage} />
          <div className="catalog-pagination"><span>Trang {currentPage.toLocaleString('vi-VN')} / {pagination.totalPages.toLocaleString('vi-VN')}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Trang trước" title="Trang trước"><ChevronLeft size={16} /></button><button type="button" onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} disabled={currentPage === pagination.totalPages} aria-label="Trang sau" title="Trang sau"><ChevronRight size={16} /></button></div></div>
        </> : <div className="catalog-empty"><strong>Không có sản phẩm phù hợp</strong><span>Hãy đổi bộ lọc hoặc từ khóa tìm kiếm.</span></div>}

        <section className="catalog-queues" aria-label="Hàng đợi xử lý catalog">
          <div className="catalog-queues-heading"><div><h3>Hàng đợi cần xử lý</h3><span>Chỉ cảnh báo để Admin kiểm tra, không tự sửa dữ liệu.</span></div><button type="button" className="catalog-icon-button" onClick={() => void queues.reload()} aria-label="Làm mới hàng đợi" title="Làm mới"><RefreshCw size={16} /></button></div>
          <div className="catalog-queue-tabs"><button type="button" className={queueTab === 'sku' ? 'is-active' : ''} onClick={() => setQueueTab('sku')}>SKU trùng <b>{queues.skuConflicts?.total ?? '—'}</b></button><button type="button" className={queueTab === 'review' ? 'is-active' : ''} onClick={() => setQueueTab('review')}>Cần review <b>{queues.needsReview?.total ?? '—'}</b></button><button type="button" className={queueTab === 'provider' ? 'is-active' : ''} onClick={() => setQueueTab('provider')}>Nguồn cấp <b>{queues.providerIssues?.total ?? '—'}</b></button><button type="button" className={queueTab === 'inventory' ? 'is-active' : ''} onClick={() => setQueueTab('inventory')}>Tồn kho <b>{queues.inventoryWarnings?.total ?? '—'}</b></button></div>
          {queueTab === 'sku' && <SkuConflictQueue data={queues.skuConflicts} />}
          {queueTab === 'review' && <NeedsReviewQueue data={queues.needsReview} />}
          {queueTab === 'provider' && <ProviderIssueQueue data={queues.providerIssues} />}
          {queueTab === 'inventory' && <InventoryWarningQueue data={queues.inventoryWarnings} />}
        </section>
          </div>
        </div>
      </section>
      {wizard && <ProductWizard mode={wizard.mode} productId={wizard.productId} cloneProductId={wizard.cloneProductId} initialCategoryId={wizard.initialCategoryId} onClose={() => setWizard(null)} onSaved={() => { setWizard(null); void loadProducts(); void loadCategories(); }} />}
      {categoryManagerOpen && <CategoryManagerDialog categories={categories} catalogVersionId={catalogVersionId} onClose={() => setCategoryManagerOpen(false)} onChanged={() => { void loadCategories(); void loadProducts(); }} />}
      {importOpen && <CatalogImportDialog categories={categories} initialCategoryId={selectedLeaf?.id} catalogVersionId={catalogVersionId} onClose={() => setImportOpen(false)} onComplete={() => { setImportOpen(false); void loadProducts(); void loadCategories(); }} />}
      <BulkPreviewDialog key={`${bulkOperation}-${bulkDialogOpen}`} open={bulkDialogOpen} entityType={entityType} operationType={bulkOperation} selection={bulkSelection.selection} preview={bulkPreview.preview} previewLoading={bulkPreview.loading} previewError={bulkPreview.error} executeLoading={bulkExecute.loading} executeError={bulkExecute.error} onClose={() => setBulkDialogOpen(false)} onPreview={runBulkPreview} onExecute={runBulkExecute} />
      <BulkResultDialog result={bulkExecute.result} onClose={() => bulkExecute.clear()} />
    </>
  );
};

export default CatalogTab;
