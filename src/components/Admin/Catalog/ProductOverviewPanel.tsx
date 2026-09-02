import { useState } from 'react';
import { ExternalLink, Image as ImageIcon, Pencil, Search, SlidersHorizontal, Sparkles, Tags, X } from 'lucide-react';
import type { CatalogProductRecord } from '../../../types/catalog';
import {
  COVERAGE_LABELS,
  OPERATION_LABELS,
  STATUS_LABELS,
  SUPPLIER_LABELS,
  formatPriceWithCurrency,
  getLowestVariantPrice,
} from './productLabels';
import ProductVariantsPreview from './ProductVariantsPreview';
import ProductFulfillmentPreview from './ProductFulfillmentPreview';
import ProductMediaPreview from './ProductMediaPreview';
import ProductSeoPreview from './ProductSeoPreview';

type PanelTab = 'overview' | 'variants' | 'fulfillment' | 'media' | 'seo';

interface ProductOverviewPanelProps {
  product: CatalogProductRecord;
  onClose: () => void;
  onEdit: () => void;
}

const TABS: Array<{ id: PanelTab; label: string; icon: typeof Search }> = [
  { id: 'overview', label: 'Tổng quan', icon: Search },
  { id: 'variants', label: 'Biến thể', icon: Tags },
  { id: 'fulfillment', label: 'Fulfillment', icon: SlidersHorizontal },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'seo', label: 'SEO', icon: Sparkles },
];

const ProductOverviewPanel = ({ product, onClose, onEdit }: ProductOverviewPanelProps) => {
  const [tab, setTab] = useState<PanelTab>('overview');
  const lowest = getLowestVariantPrice(product.variants);
  const suppliers = [...new Set(product.variants.map((variant) => variant.supplier))];
  const primaryMedium = product.variants.find((variant) => variant.medium)?.medium;
  const isMultiCurrency = lowest !== null && Array.isArray(lowest);

  return (
    <aside className="catalog-overview-panel" aria-label={`Chi tiết sản phẩm ${product.name}`}>
      <header className="catalog-overview-panel__head">
        <div className="catalog-overview-panel__head-info">
          <span className={`catalog-status catalog-status-${product.status}`}>
            {STATUS_LABELS[product.status]}
          </span>
          <button
            type="button"
            className="catalog-overview-panel__close"
            onClick={onClose}
            aria-label="Đóng panel"
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>
        <div className="catalog-overview-panel__head-product">
          {product.image ? (
            <img src={product.image} alt="" className="catalog-overview-panel__avatar" />
          ) : (
            <span className="catalog-overview-panel__avatar catalog-overview-panel__avatar--placeholder">
              {product.name.charAt(0).toLocaleUpperCase('vi-VN')}
            </span>
          )}
          <div>
            <strong>{product.name}</strong>
            <span className="catalog-mono">{product.id}</span>
          </div>
        </div>
        <div className="catalog-overview-panel__actions">
          <button type="button" className="catalog-secondary-button" onClick={onEdit}>
            <Pencil size={14} />
            <span>Sửa</span>
          </button>
          <a
            href={`/san-pham/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="catalog-text-button"
          >
            <ExternalLink size={14} />
            <span>Xem trang public</span>
          </a>
        </div>
      </header>

      <nav className="catalog-overview-panel__tabs" role="tablist">
        {TABS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`catalog-overview-panel__tab${tab === entry.id ? ' is-active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              <Icon size={14} />
              <span>{entry.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="catalog-overview-panel__body">
        {tab === 'overview' && (
          <div className="catalog-overview-panel__overview">
            <section className="catalog-overview-panel__section">
              <h4>Thông tin cơ bản</h4>
              <dl className="catalog-overview-panel__list">
                <div>
                  <dt>Tên sản phẩm</dt>
                  <dd>{product.name}</dd>
                </div>
                <div>
                  <dt>Slug</dt>
                  <dd className="catalog-mono">{product.slug}</dd>
                </div>
                <div>
                  <dt>Nghiệp vụ</dt>
                  <dd>{OPERATION_LABELS[product.operation]}</dd>
                </div>
                <div>
                  <dt>Vùng phủ</dt>
                  <dd>{COVERAGE_LABELS[product.coverageType]}</dd>
                </div>
                {product.operation !== 'device_sale' && primaryMedium && (
                  <div>
                    <dt>Hình thức</dt>
                    <dd>{primaryMedium === 'esim' ? 'eSIM' : 'SIM vật lý'}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="catalog-overview-panel__section">
              <h4>Giá bán</h4>
              {(() => {
                if (lowest === null) return <div className="catalog-overview-panel__price-empty">Chưa có variant</div>;
                if (isMultiCurrency) return <div className="catalog-overview-panel__price"><strong>Nhiều tiền tệ</strong><span>Nhiều loại tiền tệ trong sản phẩm</span></div>;
                const lp = lowest as { price: number; currency: 'VND' | 'USD' };
                return <div className="catalog-overview-panel__price"><strong>{formatPriceWithCurrency(lp.price, lp.currency)}</strong><span>Giá khởi điểm</span></div>;
              })()}
            </section>

            <section className="catalog-overview-panel__section">
              <h4>Provider</h4>
              {suppliers.length > 0 ? (
                <ul className="catalog-overview-panel__providers">
                  {suppliers.map((supplier) => (
                    <li key={supplier}>
                      <span className={`catalog-provider-dot__bullet catalog-provider-dot__bullet--${supplier}`} aria-hidden="true" />
                      <strong>{SUPPLIER_LABELS[supplier]}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="catalog-overview-panel__price-empty">Chưa có provider</div>
              )}
            </section>

            <section className="catalog-overview-panel__section">
              <h4>Trạng thái phát hành</h4>
              <ul className="catalog-overview-panel__status-list">
                <li>
                  <span>Product</span>
                  <strong>{product.status === 'active' ? 'Đang hoạt động' : STATUS_LABELS[product.status]}</strong>
                </li>
                <li>
                  <span>Variant active</span>
                  <strong>{product.variants.filter((variant) => variant.active).length}</strong>
                </li>
                <li>
                  <span>Cần review</span>
                  <strong>{product.variants.filter((variant) => variant.needsReview).length}</strong>
                </li>
              </ul>
              <p className="catalog-overview-panel__hint">
                HICO không tự động publish sản phẩm chỉ vì mở form edit. Dùng nút <strong>Sửa</strong> để cập nhật qua Product Wizard.
              </p>
            </section>
          </div>
        )}

        {tab === 'variants' && <ProductVariantsPreview product={product} />}
        {tab === 'fulfillment' && <ProductFulfillmentPreview product={product} />}
        {tab === 'media' && <ProductMediaPreview product={product} />}
        {tab === 'seo' && <ProductSeoPreview product={product} />}
      </div>
    </aside>
  );
};

export default ProductOverviewPanel;