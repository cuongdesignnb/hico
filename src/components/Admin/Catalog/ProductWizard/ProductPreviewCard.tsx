import type { ProductDraft, VariantDraft } from '../../../../types/productWizard';
import { getVariantSourceLabel } from './productWizardLabels';

interface ProductPreviewCardProps {
  product: ProductDraft;
  variants: VariantDraft[];
}

const ProductPreviewCard = ({ product, variants }: ProductPreviewCardProps) => (
  <aside className="product-wizard-preview-card">
    <span className="product-wizard-kicker">Preview</span>
    <h4>{product.name || 'Sản phẩm chưa đặt tên'}</h4>
    <p>{product.slug || 'chưa-có-slug'}</p>
    <div className="product-wizard-preview-list">
      {variants.map((variant) => <div key={variant.tempId}><strong>{variant.sku || 'SKU mới'}</strong><span>{variant.price || '0'} {variant.currency}</span><small>{getVariantSourceLabel(variant)}</small></div>)}
    </div>
  </aside>
);

export default ProductPreviewCard;
