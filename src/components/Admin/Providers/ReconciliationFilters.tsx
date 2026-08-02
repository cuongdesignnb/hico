import { Search } from 'lucide-react';
import type {
  ReconciliationFiltersState,
  ReconciliationStatus,
} from '../../../types/reconciliation';

interface ReconciliationFiltersProps {
  filters: ReconciliationFiltersState;
  onChange: (filters: ReconciliationFiltersState) => void;
}

const updateOfferType = (
  filters: ReconciliationFiltersState,
  value: string,
): ReconciliationFiltersState => {
  const next = { ...filters };
  delete next.providerProductType;
  delete next.leSIM;

  if (value === 'worldmove_esim') {
    next.providerProductType = 0;
    next.leSIM = true;
  } else if (value === 'local_esim') {
    next.providerProductType = 0;
    next.leSIM = false;
  } else if (value === 'physical') {
    next.providerProductType = 1;
  } else if (value === 'topup') {
    next.providerProductType = 2;
  }

  return next;
};

const currentOfferType = (filters: ReconciliationFiltersState) => {
  if (filters.providerProductType === 0) {
    return filters.leSIM ? 'worldmove_esim' : 'local_esim';
  }
  if (filters.providerProductType === 1) return 'physical';
  if (filters.providerProductType === 2) return 'topup';
  return 'all';
};

const ReconciliationFilters = ({
  filters,
  onChange,
}: ReconciliationFiltersProps) => (
  <div className="reconciliation-filters">
    <label className="provider-search">
      <span>Tìm kiếm</span>
      <div>
        <Search size={15} />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({
            ...filters,
            search: event.target.value,
          })}
          placeholder="Sản phẩm, SKU, wmproductId"
        />
      </div>
    </label>
    <label>
      <span>Kết quả</span>
      <select
        value={filters.status}
        onChange={(event) => onChange({
          ...filters,
          status: event.target.value as ReconciliationStatus | 'all',
        })}
      >
        <option value="all">Tất cả</option>
        <option value="MATCHED">Đã khớp</option>
        <option value="NEEDS_REVIEW">Cần xác nhận</option>
        <option value="NOT_FOUND">Không tìm thấy</option>
        <option value="MISSING_WMPRODUCT_ID">Thiếu wmproductId</option>
        <option value="DUPLICATE_PROVIDER_OFFER">Trùng offer</option>
        <option value="TYPE_CONFLICT">Xung đột loại</option>
        <option value="LEGACY_CONFLICT">Xung đột legacy</option>
        <option value="INACTIVE_PROVIDER_OFFER">Offer ngừng cung cấp</option>
        <option value="CONFIRMED_BY_ADMIN">Admin đã xác nhận</option>
        <option value="IGNORED_BY_ADMIN">Tạm bỏ qua</option>
      </select>
    </label>
    <label>
      <span>Nguồn đề xuất</span>
      <select
        value={currentOfferType(filters)}
        onChange={(event) => onChange(
          updateOfferType(filters, event.target.value),
        )}
      >
        <option value="all">Tất cả</option>
        <option value="worldmove_esim">Worldmove eSIM tự động</option>
        <option value="local_esim">eSIM nhà mạng địa phương</option>
        <option value="physical">SIM vật lý Worldmove</option>
        <option value="topup">Top-up Worldmove</option>
      </select>
    </label>
  </div>
);

export default ReconciliationFilters;
