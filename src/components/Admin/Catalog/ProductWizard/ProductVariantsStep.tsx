import { Plus } from 'lucide-react';
import type { VariantDraft } from '../../../../types/productWizard';
import VariantTable from './VariantTable';

interface ProductVariantsStepProps {
  variants: VariantDraft[];
  onAdd: () => void;
  onUpdate: (tempId: string, changes: Partial<VariantDraft>) => void;
  onDuplicate: (tempId: string) => void;
  onRemove: (tempId: string) => void;
}

const ProductVariantsStep = ({ variants, onAdd, onUpdate, onDuplicate, onRemove }: ProductVariantsStepProps) => (
  <section className="product-wizard-step-content">
    <div className="product-wizard-section-heading product-wizard-section-heading-with-action">
      <div><span className="product-wizard-kicker">Bước 3</span><h3>Gói bán</h3><p>Variant mới luôn bắt đầu inactive và chỉ có thể publish sau khi readiness đạt.</p></div>
      <button type="button" className="product-wizard-secondary-button" onClick={onAdd}><Plus size={16} /> Thêm gói</button>
    </div>
    {variants.length === 0 ? (
      <div className="product-wizard-empty"><strong>Chưa có variant</strong><span>Thêm ít nhất một gói bán để tiếp tục.</span><button type="button" className="product-wizard-primary-button" onClick={onAdd}><Plus size={16} /> Thêm variant</button></div>
    ) : <VariantTable variants={variants} onUpdate={onUpdate} onDuplicate={onDuplicate} onRemove={onRemove} />}
  </section>
);

export default ProductVariantsStep;
