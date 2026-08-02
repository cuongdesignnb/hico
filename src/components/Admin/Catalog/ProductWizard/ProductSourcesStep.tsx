import type { ProductOperation } from '../../../../types/catalog';
import type { ProviderOffer } from '../../../../types/provider';
import type { VariantDraft } from '../../../../types/productWizard';
import VariantSourceSelector from './VariantSourceSelector';

interface ProductSourcesStepProps {
  operation: ProductOperation;
  variants: VariantDraft[];
  offers: ProviderOffer[];
  offersLoading: boolean;
  onUpdate: (tempId: string, changes: Partial<VariantDraft>) => void;
}

const ProductSourcesStep = ({ operation, variants, offers, offersLoading, onUpdate }: ProductSourcesStepProps) => (
  <section className="product-wizard-step-content">
    <div className="product-wizard-section-heading"><span className="product-wizard-kicker">Bước 4</span><h3>Nguồn cấp</h3><p>Chọn nhãn nghiệp vụ. Các trường provider kỹ thuật sẽ được điền từ Offer Picker.</p></div>
    {variants.length === 0 ? <div className="product-wizard-empty"><strong>Chưa có variant để cấu hình nguồn</strong><span>Quay lại bước Gói bán để thêm variant.</span></div> : (
      <div className="product-wizard-source-list">
        {variants.map((variant, index) => (
          <article className="product-wizard-source-card" key={variant.tempId}>
            <div className="product-wizard-source-card-heading"><strong>Gói {index + 1} · {variant.sku || 'Chưa có SKU'}</strong><span>{variant.sourceMode ? 'Đã chọn nguồn' : 'Chưa chọn nguồn'}</span></div>
            <VariantSourceSelector operation={operation} variant={variant} offers={offers} offersLoading={offersLoading} onChange={(changes) => onUpdate(variant.tempId, changes)} />
          </article>
        ))}
      </div>
    )}
  </section>
);

export default ProductSourcesStep;
