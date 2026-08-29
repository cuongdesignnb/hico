import { useCallback } from 'react';
import { Search } from 'lucide-react';
import type {
  CatalogStatus,
  CoverageType,
  ProductOperation,
  SimMedium,
  Supplier,
} from '../../../types/catalog';
import { COVERAGE_LABELS, STATUS_LABELS, SUPPLIER_LABELS, MEDIUM_CHIP_LABELS } from './productLabels';

export type StatusFilter = CatalogStatus | 'all';
export type OperationFilter = ProductOperation | 'all';
export type CoverageFilter = CoverageType | 'all';
export type MediumFilter = Exclude<SimMedium, null> | 'all';
export type SupplierFilter = Supplier | 'all';
export type QuickFilter = 'esim' | 'physical_sim' | 'device_sale' | 'active' | 'draft' | 'review';

export interface CatalogFiltersState {
  operation: OperationFilter;
  medium: MediumFilter;
  supplier: SupplierFilter;
  coverage: CoverageFilter;
  status: StatusFilter;
  quick: QuickFilter | null;
}

interface ProductFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: CatalogFiltersState;
  onFiltersChange: (filters: CatalogFiltersState) => void;
}

const QUICK_CHIP_LABELS: Array<{ id: QuickFilter; label: string; group: 'medium' | 'status' | 'review' }> = [
  { id: 'esim', label: MEDIUM_CHIP_LABELS.esim, group: 'medium' },
  { id: 'physical_sim', label: MEDIUM_CHIP_LABELS.physical_sim, group: 'medium' },
  { id: 'device_sale', label: 'Thiết bị', group: 'medium' },
  { id: 'active', label: STATUS_LABELS.active, group: 'status' },
  { id: 'draft', label: STATUS_LABELS.draft, group: 'status' },
  { id: 'review', label: 'Cần review', group: 'review' },
];

const ProductFilters = ({ searchQuery, onSearchChange, filters, onFiltersChange }: ProductFiltersProps) => {
  const update = useCallback((patch: Partial<CatalogFiltersState>) => {
    onFiltersChange({ ...filters, ...patch });
  }, [filters, onFiltersChange]);

  const handleQuick = (chip: QuickFilter) => {
    // Start with full reset of quick-controlled fields
    const baseReset: CatalogFiltersState = {
      medium: 'all',
      operation: 'all',
      supplier: filters.supplier, // Keep independent filters
      coverage: filters.coverage,
      status: 'all',
      quick: null,
    };

    if (filters.quick === chip) {
      // Deselecting: reset to all
      update(baseReset);
      return;
    }

    // Apply chip-specific settings on top of base reset
    const patch: CatalogFiltersState = { ...baseReset, quick: chip };
    if (chip === 'esim' || chip === 'physical_sim') {
      patch.medium = chip;
    } else if (chip === 'device_sale') {
      patch.operation = 'device_sale';
    } else if (chip === 'active') {
      patch.status = 'active';
    } else if (chip === 'draft') {
      patch.status = 'draft';
    } else if (chip === 'review') {
      // review doesn't set any filter, just quick flag
    }
    update(patch);
  };

  return (
    <div className="catalog-filters-section">
      <div className="catalog-filters-row">
        <div className="catalog-search-wrapper">
          <Search size={16} className="catalog-search-icon" />
          <input
            type="search"
            className="catalog-search-input"
            placeholder="Tìm sản phẩm, SKU, wmproductId..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Tìm sản phẩm"
          />
        </div>

        <div className="catalog-filters-grid">
          <label className="catalog-filter-label">
            <span>Nghiệp vụ</span>
            <select
              value={filters.operation}
              onChange={(event) => update({ operation: event.target.value as OperationFilter, quick: null })}
            >
              <option value="all">Tất cả</option>
              <option value="new_subscription">Mua SIM mới</option>
              <option value="topup">Top-up</option>
              <option value="device_sale">Thiết bị</option>
            </select>
          </label>
          <label className="catalog-filter-label">
            <span>Hình thức</span>
            <select
              value={filters.medium}
              onChange={(event) => update({ medium: event.target.value as MediumFilter, quick: null })}
            >
              <option value="all">Tất cả</option>
              <option value="esim">eSIM</option>
              <option value="physical_sim">SIM vật lý</option>
            </select>
          </label>
          <label className="catalog-filter-label">
            <span>Nguồn cấp</span>
            <select
              value={filters.supplier}
              onChange={(event) => update({ supplier: event.target.value as SupplierFilter })}
            >
              <option value="all">Tất cả</option>
              {(Object.keys(SUPPLIER_LABELS) as Supplier[]).map((key) => (
                <option key={key} value={key}>{SUPPLIER_LABELS[key]}</option>
              ))}
            </select>
          </label>
          <label className="catalog-filter-label">
            <span>Vùng phủ</span>
            <select
              value={filters.coverage}
              onChange={(event) => update({ coverage: event.target.value as CoverageFilter })}
            >
              <option value="all">Tất cả</option>
              {(Object.keys(COVERAGE_LABELS) as CoverageType[]).map((key) => (
                <option key={key} value={key}>{COVERAGE_LABELS[key]}</option>
              ))}
            </select>
          </label>
          <label className="catalog-filter-label">
            <span>Trạng thái</span>
            <select
              value={filters.status}
              onChange={(event) => update({ status: event.target.value as StatusFilter, quick: null })}
            >
              <option value="all">Tất cả</option>
              {(Object.keys(STATUS_LABELS) as CatalogStatus[]).map((key) => (
                <option key={key} value={key}>{STATUS_LABELS[key]}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="catalog-quick-chips" role="tablist" aria-label="Lọc nhanh">
        {QUICK_CHIP_LABELS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`catalog-quick-chip catalog-quick-chip--${chip.group}${filters.quick === chip.id ? ' is-active' : ''}`}
            onClick={() => handleQuick(chip.id)}
            aria-pressed={filters.quick === chip.id}
          >
            {chip.label}
          </button>
        ))}
        {filters.quick !== null && (
          <button
            type="button"
            className="catalog-quick-chip catalog-quick-chip--reset"
            onClick={() => update({ quick: null, medium: 'all', operation: 'all', status: 'all' })}
          >
            Xoá lọc nhanh
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductFilters;
