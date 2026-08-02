import type { VariantDraft } from '../../../../types/productWizard';

interface VariantEditorProps {
  variant: VariantDraft;
  compact?: boolean;
  onChange: (changes: Partial<VariantDraft>) => void;
}

const VariantEditor = ({ variant, compact = false, onChange }: VariantEditorProps) => (
  <div className={`product-wizard-variant-editor ${compact ? 'is-compact' : ''}`}>
    <label className="product-wizard-field"><span>SKU <b>*</b></span><input value={variant.sku} onChange={(event) => onChange({ sku: event.target.value })} placeholder="JP-10GB-30D" /></label>
    <label className="product-wizard-field"><span>Dung lượng</span><input value={variant.dataLimit} onChange={(event) => onChange({ dataLimit: event.target.value })} placeholder="10GB" /></label>
    <label className="product-wizard-field"><span>Thời hạn</span><input value={variant.duration} onChange={(event) => onChange({ duration: event.target.value })} placeholder="30 ngày" /></label>
    <label className="product-wizard-field"><span>Giá bán <b>*</b></span><input type="number" min="0" value={variant.price} onChange={(event) => onChange({ price: event.target.value })} /></label>
    <label className="product-wizard-field"><span>Giá so sánh</span><input type="number" min="0" value={variant.compareAtPrice} onChange={(event) => onChange({ compareAtPrice: event.target.value })} /></label>
    <label className="product-wizard-field"><span>Tiền tệ</span><select value={variant.currency} onChange={(event) => onChange({ currency: event.target.value as VariantDraft['currency'] })}><option value="VND">VND</option><option value="USD">USD</option></select></label>
  </div>
);

export default VariantEditor;
