import { Activity, Globe, Radio, Star, Zap } from 'lucide-react';
import type { PublicProduct, PublicVariant } from '../../types/publicCatalog';
import {
  featureActivationLabel,
  featureHotspotLabel,
  featureNetworkLabel,
  featureSpeedLabel,
} from '../../adapters/productDetailViewModel';
import { productCategoryLabel } from '../../adapters/productDetailViewModel';
import { stripHtml } from '../../utils/sanitizeHtml';

interface ProductHeroInfoProps {
  product: PublicProduct;
  variant: PublicVariant | null;
  ratingAverage: number;
  ratingCount: number;
  ratingLoaded: boolean;
}

interface FeatureCell {
  icon: typeof Radio;
  label: string;
  value: string;
}

const buildFeatureCells = (
  product: PublicProduct,
  variant: PublicVariant | null,
): FeatureCell[] => {
  const cells: FeatureCell[] = [];

  const network = featureNetworkLabel(product, variant);
  if (network) cells.push({ icon: Globe, label: 'Mạng', value: network });

  const activation = featureActivationLabel(product);
  if (activation) cells.push({ icon: Zap, label: 'Kích hoạt', value: activation });

  const hotspot = featureHotspotLabel(product, variant);
  if (hotspot) cells.push({ icon: Radio, label: 'Chia sẻ', value: hotspot });

  const speed = featureSpeedLabel(product, variant);
  if (speed) cells.push({ icon: Activity, label: 'Tốc độ', value: speed });

  return cells;
};

const renderStars = (rating: number): React.ReactElement => {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="pdp-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((position) => (
        <Star
          key={position}
          size={14}
          fill={position <= rounded ? '#FF9F00' : 'none'}
          stroke="#FF9F00"
        />
      ))}
    </div>
  );
};

export const ProductHeroInfo = ({
  product,
  variant,
  ratingAverage,
  ratingCount,
  ratingLoaded,
}: ProductHeroInfoProps) => {
  const shortDescriptionSource = product.seo?.description
    || stripHtml(product.description)
    || stripHtml(product.guide);
  const shortDescription = shortDescriptionSource.slice(0, 360);
  const featureCells = buildFeatureCells(product, variant);
  const category = productCategoryLabel(product);

  return (
    <div className="pdp-hero-info">
      <span className="pdp-kicker">{category}</span>
      <h1 className="pdp-title">{product.name}</h1>

      {ratingCount > 0 && ratingLoaded && (
        <div className="pdp-rating-row" aria-label={`Đánh giá ${ratingAverage} trên 5 từ ${ratingCount} người`}>
          {renderStars(ratingAverage)}
          <span className="pdp-rating-value">{ratingAverage.toFixed(1)}</span>
          <span className="pdp-rating-count">({ratingCount.toLocaleString('vi-VN')} đánh giá)</span>
        </div>
      )}

      {shortDescription && (
        <p className="pdp-short-desc">{shortDescription}</p>
      )}

      {featureCells.length > 0 && (
        <div className="pdp-feature-grid">
          {featureCells.map(({ icon: Icon, label, value }) => (
            <div key={label} className="pdp-feature-cell">
              <Icon size={20} className="pdp-feature-icon" aria-hidden="true" />
              <div className="pdp-feature-text">
                <span className="pdp-feature-label">{label}</span>
                <span className="pdp-feature-value">{value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductHeroInfo;
