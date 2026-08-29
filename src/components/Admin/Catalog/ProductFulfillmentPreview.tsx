import type { CatalogProductRecord } from '../../../types/catalog';
import { FULFILLMENT_LABELS } from './productLabels';

interface ProductFulfillmentPreviewProps {
  product: CatalogProductRecord;
}

const ProductFulfillmentPreview = ({ product }: ProductFulfillmentPreviewProps) => {
  if (product.variants.length === 0) {
    return (
      <div className="catalog-preview-empty">
        <strong>Chưa có thông tin fulfillment</strong>
        <span>Sản phẩm cần ít nhất một variant để hiển thị cấu hình fulfillment.</span>
      </div>
    );
  }

  return (
    <div className="catalog-preview-fulfillment">
      {product.variants.map((variant) => (
        <div key={variant.id} className="catalog-preview-fulfillment__card">
          <div className="catalog-preview-fulfillment__head">
            <strong>{variant.sku}</strong>
            <span className="catalog-fulfillment-method">
              {FULFILLMENT_LABELS[variant.fulfillmentMethod]}
            </span>
          </div>

          <dl className="catalog-preview-fulfillment__list">
            <div>
              <dt>Nhà cung cấp</dt>
              <dd>
                <span className="catalog-provider-dot__bullet" aria-hidden="true" />
                {variant.supplier}
              </dd>
            </div>
            {variant.wmproductId && (
              <div>
                <dt>wmproductId</dt>
                <dd className="catalog-mono">{variant.wmproductId}</dd>
              </div>
            )}
            {variant.providerOfferId && (
              <div>
                <dt>providerOfferId</dt>
                <dd className="catalog-mono">{variant.providerOfferId}</dd>
              </div>
            )}
            {variant.providerProductId && (
              <div>
                <dt>providerProductId</dt>
                <dd className="catalog-mono">{variant.providerProductId}</dd>
              </div>
            )}
            {variant.providerProductType !== null && variant.providerProductType !== undefined && (
              <div>
                <dt>providerProductType</dt>
                <dd className="catalog-mono">{variant.providerProductType}</dd>
              </div>
            )}
            <div>
              <dt>leSIM</dt>
              <dd>
                {variant.leSIM === true
                  ? 'Có'
                  : variant.leSIM === false
                    ? 'Không'
                    : 'Không xác định'}
              </dd>
            </div>
            <div>
              <dt>Yêu cầu SIM sẵn</dt>
              <dd>{variant.requiresExistingSim ? 'Có' : 'Không'}</dd>
            </div>
            <div>
              <dt>Physical order</dt>
              <dd>{variant.fulfillmentMethod === 'WORLDMOVE_PHYSICAL_ORDER' ? 'Có' : 'Không'}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                {variant.active
                  ? 'Đang hoạt động'
                  : variant.needsReview
                    ? 'Cần review'
                    : 'Không hoạt động'}
              </dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
};

export default ProductFulfillmentPreview;
