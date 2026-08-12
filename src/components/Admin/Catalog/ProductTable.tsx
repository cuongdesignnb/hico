import { AlertTriangle, Pencil } from 'lucide-react';
import type {
  CatalogAdminProductSummary,
  CatalogStatus,
  CoverageType,
  ProductOperation,
  Supplier,
} from '../../../types/catalog';
import type { BulkEntityType } from '../../../types/catalogBulk';

interface ProductTableProps {
  products: CatalogAdminProductSummary[];
  onEdit: (productId: string) => void;
  entityType: BulkEntityType;
  selectedIds: string[];
  onTogglePage: (ids: string[]) => void;
}

const operationLabels: Record<ProductOperation, string> = {
  new_subscription: 'Mua SIM mới',
  topup: 'Top-up',
  device_sale: 'Thiết bị',
};

const coverageLabels: Record<CoverageType, string> = {
  country: 'Một quốc gia',
  region: 'Khu vực',
  global: 'Toàn cầu',
  not_applicable: 'Không áp dụng',
};

const supplierLabels: Record<Supplier, string> = {
  worldmove: 'Worldmove',
  local_carrier: 'Nhà mạng địa phương',
  hico: 'HICO',
  other: 'Chưa xác nhận',
};

const statusLabels: Record<CatalogStatus, string> = {
  active: 'Đang bán',
  draft: 'Bản nháp',
  archived: 'Lưu trữ',
};

const formatPrice = (product: CatalogAdminProductSummary) => {
  const activeVariants = product.variants.filter((variant) => variant.active);
  const variants = activeVariants.length > 0 ? activeVariants : product.variants;

  if (variants.length === 0) {
    return 'Chưa có giá';
  }

  const lowestVariant = variants.reduce((lowest, variant) => (
    variant.price < lowest.price ? variant : lowest
  ));

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: lowestVariant.currency,
    maximumFractionDigits: 0,
  }).format(lowestVariant.price);
};

const getSupplierSummary = (product: CatalogAdminProductSummary) => {
  const suppliers = [...new Set(product.variants.map((variant) => variant.supplier))];

  if (suppliers.length === 0) {
    return 'Chưa có nguồn';
  }

  if (suppliers.length > 2) {
    return `${suppliers.length} nguồn`;
  }

  return suppliers.map((supplier) => supplierLabels[supplier]).join(', ');
};

const ProductTable = ({ products, onEdit, entityType, selectedIds, onTogglePage }: ProductTableProps) => {
  const pageIds = products.flatMap((product) => entityType === 'product' ? [product.id] : product.variantIds);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  return (
  <div className="catalog-table-scroll">
    <table className="catalog-table">
      <thead>
        <tr>
          <th className="catalog-select-cell"><input type="checkbox" checked={allSelected} onChange={() => onTogglePage(pageIds)} aria-label="Chọn toàn bộ trang" /></th>
          <th>Sản phẩm</th>
          <th>Loại nghiệp vụ</th>
          <th>Vùng phủ</th>
          <th>Số gói</th>
          <th>Giá từ</th>
          <th>Nguồn</th>
          <th>Trạng thái</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => {
          const reviewCount = product.needsReviewCount;

          return (
            <tr key={product.id}>
              <td className="catalog-select-cell">
                <input
                  type="checkbox"
                  checked={(() => {
                    const ids = entityType === 'product' ? [product.id] : product.variantIds;
                    return ids.length > 0 && ids.every((id) => selectedIds.includes(id));
                  })()}
                  onChange={() => onTogglePage(entityType === 'product' ? [product.id] : product.variantIds)}
                  aria-label={`Chọn ${product.name}`}
                />
              </td>
              <td>
                <div className="catalog-product-cell">
                  {product.image ? (
                    <img src={product.image} alt="" className="catalog-product-image" />
                  ) : (
                    <span className="catalog-product-placeholder" aria-hidden="true">
                      {product.name.charAt(0).toLocaleUpperCase('vi-VN')}
                    </span>
                  )}
                  <div className="catalog-product-copy">
                    <strong>{product.name}</strong>
                    <span>{product.id}</span>
                    {reviewCount > 0 && (
                      <span className="catalog-review-warning">
                        <AlertTriangle size={12} />
                        {reviewCount.toLocaleString('vi-VN')} gói cần xác nhận nguồn
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td>{operationLabels[product.operation]}</td>
              <td>{coverageLabels[product.coverageType]}</td>
              <td>{product.variantCount.toLocaleString('vi-VN')}</td>
              <td className="catalog-price-cell">{formatPrice(product)}</td>
              <td>{getSupplierSummary(product)}</td>
              <td>
                <span className={`catalog-status catalog-status-${product.status}`}>
                  {statusLabels[product.status]}
                </span>
              </td>
              <td>
                <button type="button" className="catalog-icon-button" onClick={() => onEdit(product.id)} aria-label={`Sửa sản phẩm ${product.name}`} title="Sửa sản phẩm">
                  <Pencil size={15} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
  );
};

export default ProductTable;
