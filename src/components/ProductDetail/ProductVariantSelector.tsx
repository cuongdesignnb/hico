import type { PublicProduct } from '../../types/publicCatalog';

export const ProductVariantSelector = ({ product, selectedId, onChange }: { product: PublicProduct; selectedId: string | null; onChange: (variantId: string) => void }) => (
  <fieldset className="canonical-variant-selector">
    <legend>Chọn gói</legend>
    <div className="canonical-variant-grid">{product.variants.map((variant) => <label key={variant.id} className={variant.id === selectedId ? 'selected' : ''}><input type="radio" name="canonical-variant" value={variant.id} checked={variant.id === selectedId} onChange={() => onChange(variant.id)} /><span><strong>{variant.dataLimit || variant.sku}</strong><small>{variant.duration || 'Theo gói'} · {variant.medium === 'physical_sim' ? 'SIM vật lý' : variant.medium === 'esim' ? 'eSIM' : 'Sản phẩm'}</small></span><b>{variant.price.toLocaleString('vi-VN')} {variant.currency}</b></label>)}</div>
  </fieldset>
);
