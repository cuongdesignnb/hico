import { useEffect, useState } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import type { PublicProduct, PublicVariant } from '../../types/publicCatalog';
import { getProductMedia } from '../../utils/productMedia';
import { useApp } from '../../context/useApp';
import {
  availableSimTypes,
  groupVariantsBySimType,
  isDurationCompatible,
  resolveVariantId,
  simTypeForVariant,
  uniqueDataLimits,
  uniqueDurations,
  type SimTypeKey,
} from '../../utils/productVariantGroups';
import { useProductReviewsSummary } from '../../hooks/catalog/useProductReviewsSummary';
import { productCategoryLabel } from '../../adapters/productDetailViewModel';
import ProductGalleryVertical from './ProductGalleryVertical';
import ProductHeroInfo from './ProductHeroInfo';
import SimTypeSelector from './SimTypeSelector';
import DataSelector from './DataSelector';
import DurationSelector from './DurationSelector';
import ProductPurchaseCard from './ProductPurchaseCard';
import ProductBenefits from './ProductBenefits';
import ProductDetailTabs from './ProductDetailTabs';
import ProductRecommendations from './ProductRecommendations';
import './ProductDetailV2.css';

interface ProductDetailProps {
  product: PublicProduct;
}

const initialSimType = (product: PublicProduct): SimTypeKey | null => {
  if (!product.variants?.length) return null;
  const groups = groupVariantsBySimType(product);
  const firstAvailable = Object.entries(groups).find(([, list]) => list.length > 0);
  if (!firstAvailable) return null;
  const [key] = firstAvailable;
  return key as SimTypeKey;
};

const initialDataLimit = (product: PublicProduct, simType: SimTypeKey | null): string | null =>
  uniqueDataLimits(product, simType)[0] ?? null;

const initialDuration = (product: PublicProduct, simType: SimTypeKey | null, dataLimit: string | null): string | null =>
  uniqueDurations(product, simType, dataLimit)[0] ?? null;

export const ProductDetail = ({ product }: ProductDetailProps) => {
  const { addToCart, setIsCartOpen, triggerNotification } = useApp();
  const { rows: reviewRows, summary } = useProductReviewsSummary(product.id);

  const [simType, setSimType] = useState<SimTypeKey | null>(() => initialSimType(product));
  const [dataLimit, setDataLimit] = useState<string | null>(() => initialDataLimit(product, initialSimType(product)));
  const [duration, setDuration] = useState<string | null>(() => initialDuration(product, initialSimType(product), initialDataLimit(product, initialSimType(product))));
  const [variantId, setVariantId] = useState<string | null>(() => resolveVariantId(product, { simType: initialSimType(product), dataLimit: null, duration: null }));
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    queueMicrotask(() => {
      const sim = initialSimType(product);
      const data = initialDataLimit(product, sim);
      const dur = initialDuration(product, sim, data);
      setSimType(sim);
      setDataLimit(data);
      setDuration(dur);
      setVariantId(resolveVariantId(product, { simType: sim, dataLimit: data, duration: dur }));
      setQuantity(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only reset when product changes identity, not when its variants array reference changes.
  }, [product.id]);

  useEffect(() => {
    queueMicrotask(() => {
      const next = resolveVariantId(product, { simType, dataLimit, duration });
      if (next) setVariantId(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-resolve when selection changes; product is captured fresh each render.
  }, [simType, dataLimit, duration]);

  const variant = variantId ? product.variants.find((item) => item.id === variantId) ?? null : null;
  const simOptions = availableSimTypes(product);
  const dataOptions = uniqueDataLimits(product, simType);
  const durationOptions = uniqueDurations(product, simType, dataLimit);

  const onSimTypeSelect = (key: SimTypeKey) => {
    setSimType(key);
    const allowedData = uniqueDataLimits(product, key);
    if (dataLimit && !allowedData.includes(dataLimit)) {
      setDataLimit(allowedData[0] ?? null);
    }
  };

  const onDataSelect = (value: string) => {
    setDataLimit(value);
    const allowedDuration = uniqueDurations(product, simType, value);
    if (duration && !allowedDuration.includes(duration)) {
      setDuration(allowedDuration[0] ?? null);
    }
  };

  const onDurationSelect = (value: string) => setDuration(value);

  const isDurationOk = (value: string) => isDurationCompatible(product, simType, dataLimit, value);

  const category = productCategoryLabel(product);

  const variantAvailable = Boolean(variant?.active && (variant.availability.inStock || !variant.availability.stockKnown));

  const cartItem = variant ? {
    id: variant.id,
    productId: product.id,
    variantId: variant.id,
    slug: product.slug,
    name: product.name,
    operation: product.operation,
    type: product.operation === 'device_sale' ? ('device' as const) : variant.medium === 'physical_sim' ? ('physical' as const) : ('esim' as const),
    simType: simTypeForVariant(variant) ?? '',
    price: variant.price,
    currency: variant.currency,
    originalPrice: variant.compareAtPrice ?? undefined,
    duration: variant.duration ?? undefined,
    dataLimit: variant.dataLimit ?? undefined,
    image: getProductMedia(product),
  } : null;

  const handleAddToCart = (openCart: boolean) => {
    if (!cartItem || !variantAvailable) {
      triggerNotification('Gói sản phẩm hiện không khả dụng.', 'error');
      return;
    }
    for (let index = 0; index < quantity; index += 1) addToCart(cartItem);
    if (openCart) setIsCartOpen(true);
  };

  return (
    <div className="pdp-page fade-in">
      <div className="pdp-container">
        <nav className="pdp-breadcrumb" aria-label="Breadcrumb">
          <a href="/" className="pdp-breadcrumb-item"><Home size={14} aria-hidden="true" /> Trang chủ</a>
          <ChevronRight size={14} className="pdp-breadcrumb-sep" aria-hidden="true" />
          <span className="pdp-breadcrumb-item">{category}</span>
          <ChevronRight size={14} className="pdp-breadcrumb-sep" aria-hidden="true" />
          <span className="pdp-breadcrumb-item is-active">{product.name}</span>
        </nav>

        <div className="pdp-grid">
          <div className="pdp-grid-gallery">
            <ProductGalleryVertical product={product} />
          </div>

          <div className="pdp-grid-info">
            <ProductHeroInfo
              product={product}
              variant={variant}
              ratingAverage={summary.average}
              ratingCount={summary.count}
              ratingLoaded={summary.loaded}
            />

            {simOptions.length > 0 && (
              <SimTypeSelector
                available={simOptions}
                selected={simType}
                onSelect={onSimTypeSelect}
              />
            )}

            {simType && dataOptions.length > 0 && (
              <DataSelector
                options={dataOptions}
                selected={dataLimit}
                onSelect={onDataSelect}
              />
            )}

            {simType && durationOptions.length > 0 && (
              <DurationSelector
                options={durationOptions}
                selected={duration}
                onSelect={onDurationSelect}
                isCompatible={isDurationOk}
                stepNumber={dataOptions.length > 0 ? 3 : 2}
              />
            )}
          </div>

          <div className="pdp-grid-purchase">
            <ProductPurchaseCard
              product={product}
              variant={variant}
              quantity={quantity}
              onQuantityChange={setQuantity}
              onAddToCart={() => handleAddToCart(false)}
              onBuyNow={() => handleAddToCart(true)}
              onOpenCart={() => setIsCartOpen(true)}
              variantAvailable={variantAvailable}
            />
          </div>
        </div>

        <ProductBenefits product={product} variant={variant} />

        <div className="pdp-bottom-grid">
          <div className="pdp-bottom-grid-tabs">
            <ProductDetailTabs product={product} variant={variant} reviews={reviewRows} />
          </div>
          <div className="pdp-bottom-grid-aside">
            <ProductRecommendations product={product} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;

// Re-export so older imports keep working if anything still pulls the variant
// type from this barrel file.
export type { PublicVariant };