import { AlertTriangle, Eye, Pencil } from 'lucide-react';
import type {
  CatalogProductRecord,
  CatalogStatus,
  CoverageType,
  ProductOperation,
  SimMedium,
  Supplier,
} from '../../../types/catalog';
import type { BulkEntityType } from '../../../types/catalogBulk';
import {
  COVERAGE_LABELS,
  MEDIUM_CHIP_LABELS,
  OPERATION_LABELS,
  STATUS_LABELS,
  SUPPLIER_LABELS,
  formatPriceWithCurrency,
  getLowestVariantPrice,
} from './productLabels';

interface ProductTableProps {
  products: CatalogProductRecord[];
  onEdit: (productId: string) => void;
  entityType: BulkEntityType;
  selectedIds: string[];
  onTogglePage: (ids: string[]) => void;
  selectedProductId?: string | null;
  onSelect?: (productId: string) => void;
}

const operationLabels: Record<ProductOperation, string> = OPERATION_LABELS;
const coverageLabels: Record<CoverageType, string> = COVERAGE_LABELS;
const supplierLabels: Record<Supplier, string> = SUPPLIER_LABELS;
const statusLabels: Record<CatalogStatus, string> = STATUS_LABELS;
const mediumLabels: Record<Exclude<SimMedium, null>, string> = MEDIUM_CHIP_LABELS;

const ProductTable = ({ products, onEdit, entityType, selectedIds, onTogglePage, selectedProductId, onSelect }: ProductTableProps) => {
  const pageIds = products.flatMap((product) => entityType === 'product' ? [product.id] : product.variants.map((variant) => variant.id));
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  return (
  <div className="catalog-table-scroll">
    <table className="catalog-table">
      <thead>
        <tr>
          <th className="catalog-select-cell"><input type="checkbox" checked={allSelected} onChange={() => onTogglePage(pageIds)} aria-label="Chọn toàn bộ trang" /></th>
          <th>Sản phẩm</th>
          <th>Loại</th>
          <th>Danh mục</th>
          <th>Giá</th>
          <th>Tiền tệ</th>
          <th>Trạng thái</th>
          <th>Provider</th>
          <th>Tồn kho / QR</th>
          <th className="catalog-actions-cell">Hành động</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => {
          const reviewCount = product.variants.filter((variant) => variant.needsReview).length;
          const isSelected = selectedProductId === product.id;
          const lowest = getLowestVariantPrice(product.variants);

          return (
            <tr
              key={product.id}
              className={`${isSelected ? 'catalog-row-selected' : ''}`}
              onClick={() => onSelect?.(product.id)}
            >
              <td className="catalog-select-cell" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={(() => {
                    const ids = entityType === 'product' ? [product.id] : product.variants.map((variant) => variant.id);
                    return ids.length > 0 && ids.every((id) => selectedIds.includes(id));
                  })()}
                  onChange={() => onTogglePage(entityType === 'product' ? [product.id] : product.variants.map((variant) => variant.id))}
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
                    <span className="catalog-product-id">{product.id}</span>
                    {reviewCount > 0 && (
                      <span className="catalog-review-warning">
                        <AlertTriangle size={12} />
                        {reviewCount.toLocaleString('vi-VN')} gói cần xác nhận nguồn
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <div className="catalog-type-cell">
                  <span className="catalog-medium-chip">
                    {operationLabels[product.operation]}
                  </span>
                  {product.operation !== 'device_sale' && (
                    <span className="catalog-medium-tag">
                      {(() => {
                        const mediums = [...new Set(product.variants.map((v) => v.medium).filter(Boolean))];
                        if (mediums.length === 0) return '—';
                        if (mediums.length === 1) return mediumLabels[mediums[0] as Exclude<SimMedium, null>];
                        return `${mediums.length} loại SIM`;
                      })()}
                    </span>
                  )}
                </div>
              </td>
              <td>
                <span className="catalog-coverage-tag">
                  {coverageLabels[product.coverageType]}
                </span>
              </td>
              <td className="catalog-price-cell">
                {lowest === null ? (
                  'Chưa có giá'
                ) : Array.isArray(lowest) ? (
                  <span className="catalog-price-multi">Nhiều tiền tệ</span>
                ) : (
                  formatPriceWithCurrency(lowest.price, lowest.currency)
                )}
              </td>
              <td>
                {lowest !== null && !Array.isArray(lowest) ? (
                  <span className={`catalog-currency-tag catalog-currency-tag--${lowest.currency.toLowerCase()}`}>
                    {lowest.currency}
                  </span>
                ) : (
                  <span className="catalog-currency-tag">—</span>
                )}
              </td>
              <td>
                <span className={`catalog-status catalog-status-${product.status}`}>
                  {statusLabels[product.status]}
                </span>
              </td>
              <td>
                <ProviderCell product={product} />
              </td>
              <td>
                <InventoryCell product={product} />
              </td>
              <td className="catalog-actions-cell" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="catalog-icon-button"
                  onClick={() => onSelect?.(product.id)}
                  aria-label={`Xem chi tiết ${product.name}`}
                  title="Xem chi tiết"
                >
                  <Eye size={15} />
                </button>
                <button
                  type="button"
                  className="catalog-icon-button"
                  onClick={() => onEdit(product.id)}
                  aria-label={`Sửa sản phẩm ${product.name}`}
                  title="Sửa sản phẩm"
                >
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

const ProviderCell = ({ product }: { product: CatalogProductRecord }) => {
  const suppliers = [...new Set(product.variants.map((variant) => variant.supplier))];
  if (suppliers.length === 0) {
    return <span className="catalog-provider-empty">Chưa có nguồn</span>;
  }
  if (suppliers.length > 2) {
    return <span className="catalog-provider-multi">{suppliers.length} nguồn</span>;
  }
  return (
    <span className="catalog-provider-cell">
      {suppliers.map((supplier) => (
        <span key={supplier} className={`catalog-provider-dot catalog-provider-dot--${supplier}`}>
          <span className="catalog-provider-dot__bullet" aria-hidden="true" />
          {supplierLabels[supplier]}
        </span>
      ))}
    </span>
  );
};

const InventoryCell = ({ product }: { product: CatalogProductRecord }) => {
  if (product.variants.length === 0) {
    return <span className="catalog-inventory-empty">—</span>;
  }

  // Check for manual QR fulfillment
  const hasManualQr = product.variants.some((v) => v.fulfillmentMethod === 'HICO_MANUAL_QR');
  if (hasManualQr) {
    return <span className="catalog-inventory-tag catalog-inventory-tag--ok">Manual QR</span>;
  }

  // Check for physical stock using persisted stock values, not variant count.
  const physicalVariants = product.variants.filter(
    (variant) => variant.fulfillmentMethod === 'HICO_PHYSICAL_STOCK',
  );
  if (physicalVariants.length > 0) {
    const physicalStock = physicalVariants.reduce(
      (total, variant) => total + (variant.stock ?? 0),
      0,
    );
    const label = product.operation === 'device_sale' ? 'thiết bị' : 'SIM';
    return <span className="catalog-inventory-tag">{physicalStock} {label}</span>;
  }

  // Check for provider-based fulfillment
  const providerCount = product.variants.filter((v) => v.fulfillmentMethod.startsWith('WORLDMOVE_')).length;
  if (providerCount > 0) {
    const isPhysical = product.variants.some((v) => v.fulfillmentMethod === 'WORLDMOVE_PHYSICAL_ORDER');
    return (
      <span className="catalog-inventory-tag catalog-inventory-tag--provider">
        {isPhysical ? 'Provider · Physical' : 'Provider'}
      </span>
    );
  }

  return <span className="catalog-inventory-empty">—</span>;
};

export default ProductTable;