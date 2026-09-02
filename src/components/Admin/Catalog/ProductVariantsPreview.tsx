import type { CatalogProductRecord } from '../../../types/catalog';
import {
  FULFILLMENT_LABELS,
  STATUS_LABELS,
  SUPPLIER_LABELS,
  formatPriceWithCurrency,
} from './productLabels';

interface ProductVariantsPreviewProps {
  product: CatalogProductRecord;
}

const ProductVariantsPreview = ({ product }: ProductVariantsPreviewProps) => {
  if (product.variants.length === 0) {
    return (
      <div className="catalog-preview-empty">
        <strong>Sản phẩm chưa có variant</strong>
        <span>Hãy thêm variant trong Product Wizard.</span>
      </div>
    );
  }

  return (
    <div className="catalog-preview-variants">
      <div className="catalog-preview-variants__summary">
        <div>
          <span>Tổng variant</span>
          <strong>{product.variants.length}</strong>
        </div>
        <div>
          <span>Đang bán</span>
          <strong>{product.variants.filter((v) => v.active).length}</strong>
        </div>
        <div>
          <span>Cần review</span>
          <strong>{product.variants.filter((v) => v.needsReview).length}</strong>
        </div>
      </div>

      <div className="catalog-preview-variants__list">
        {product.variants.map((variant) => (
          <div key={variant.id} className="catalog-preview-variant">
            <div className="catalog-preview-variant__head">
              <strong>{variant.dataLimit || variant.duration || variant.sku}</strong>
              <span className={`catalog-status catalog-status-${variant.active ? 'active' : 'draft'}`}>
                {variant.active ? STATUS_LABELS.active : STATUS_LABELS.draft}
              </span>
            </div>
            <div className="catalog-preview-variant__body">
              <div>
                <span>Giá</span>
                <strong>{formatPriceWithCurrency(variant.price, variant.currency)}</strong>
              </div>
              <div>
                <span>SKU</span>
                <strong className="catalog-mono">{variant.sku}</strong>
              </div>
              <div>
                <span>Nhà cung cấp</span>
                <strong>{SUPPLIER_LABELS[variant.supplier]}</strong>
              </div>
              <div>
                <span>Fulfillment</span>
                <strong>{FULFILLMENT_LABELS[variant.fulfillmentMethod]}</strong>
              </div>
              {variant.wmproductId && (
                <div>
                  <span>wmproductId</span>
                  <strong className="catalog-mono">{variant.wmproductId}</strong>
                </div>
              )}
              {variant.providerOfferId && (
                <div>
                  <span>providerOfferId</span>
                  <strong className="catalog-mono">{variant.providerOfferId}</strong>
                </div>
              )}
            </div>
            {variant.needsReview && (
              <div className="catalog-preview-variant__warning">
                Variant này cần xác nhận nguồn trước khi publish.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductVariantsPreview;
