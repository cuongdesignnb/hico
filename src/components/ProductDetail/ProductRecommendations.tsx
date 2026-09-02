import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PublicProduct } from '../../types/publicCatalog';
import { useProductRecommendations } from '../../hooks/catalog/useProductRecommendations';
import { getCanonicalProductPath } from '../../routing/canonicalRoute';
import { formatPriceWithCurrency } from '../../adapters/productDetailViewModel';

interface ProductRecommendationsProps {
  product: PublicProduct;
}

export const ProductRecommendations = ({ product }: ProductRecommendationsProps) => {
  const { items, loaded } = useProductRecommendations(product);

  if (!loaded) return null;
  if (items.length === 0) return null;

  return (
    <section className="pdp-recommendations" aria-label="Gợi ý gói phổ biến">
      <header className="pdp-recommendations-header">
        <h4 className="pdp-section-heading">Gợi ý gói phổ biến</h4>
        <span className="pdp-recommendations-hint">Sản phẩm cùng khu vực</span>
      </header>
      <ul className="pdp-recommendations-list">
        {items.map((item) => (
          <li key={item.id} className="pdp-recommendations-item">
            <Link to={getCanonicalProductPath({ operation: product.operation, slug: item.slug })} className="pdp-recommendations-link">
              <div className="pdp-recommendations-meta">
                <span className="pdp-recommendations-name">{item.name}</span>
                <span className="pdp-recommendations-extra">
                  {item.dataLimit ?? '—'} {item.duration ? `· ${item.duration}` : ''}
                </span>
              </div>
              <div className="pdp-recommendations-price-row">
                <span className="pdp-recommendations-price">{formatPriceWithCurrency(item.price, item.currency)}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ProductRecommendations;