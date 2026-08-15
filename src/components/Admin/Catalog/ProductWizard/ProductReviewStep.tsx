import type { ProductReadinessResult, ProductWizardState } from '../../../../types/productWizard';
import { operationLabels } from './productWizardLabels';
import ProductPreviewCard from './ProductPreviewCard';
import PublishReadinessPanel from './PublishReadinessPanel';

interface ProductReviewStepProps {
  state: ProductWizardState;
  readiness: ProductReadinessResult | null;
  readinessLoading: boolean;
  onCheckReadiness: () => void;
}

const ProductReviewStep = ({ state, readiness, readinessLoading, onCheckReadiness }: ProductReviewStepProps) => (
  <section className="product-wizard-step-content">
    <div className="product-wizard-section-heading"><span className="product-wizard-kicker">Bước 4</span><h3>Kiểm tra và lưu nháp</h3><p>Đây là bước review và lưu canonical draft, không tự publish.</p></div>
    <div className="product-wizard-review-layout">
      <div className="product-wizard-review-main">
        <div className="product-wizard-summary-grid">
          <div><span>Loại nghiệp vụ</span><strong>{operationLabels[state.product.operation]}</strong></div>
          <div><span>Danh mục</span><strong>{state.product.categoryId || 'Chưa chọn'}</strong></div>
          <div><span>Vùng phủ</span><strong>{state.product.coverageType} · {state.product.coverageIds.length} mục</strong></div>
          <div><span>Variants</span><strong>{state.variants.length}</strong></div>
          <div><span>Catalog version</span><strong>{state.catalogVersionId || 'Chưa có'}</strong></div>
        </div>
        {state.validationErrors.length > 0 && <div className="product-wizard-alert product-wizard-alert-error">{state.validationErrors.length} lỗi client cần xử lý trước khi lưu.</div>}
        {state.validationWarnings.map((warning) => <div className="product-wizard-alert product-wizard-alert-warning" key={`${warning.step}-${warning.message}`}>{warning.message}</div>)}
        <PublishReadinessPanel readiness={readiness} loading={readinessLoading} onCheck={onCheckReadiness} />
      </div>
      <ProductPreviewCard product={state.product} variants={state.variants} />
    </div>
  </section>
);

export default ProductReviewStep;
