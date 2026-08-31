import { useEffect, useMemo, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { PublicProduct, PublicProductMedia } from '../../types/publicCatalog';
import { getNeutralProductMedia, productMediaCategory } from '../../utils/productMedia';

interface ProductGalleryVerticalProps {
  product: PublicProduct;
}

const sortByOrder = (items: PublicProductMedia[]): PublicProductMedia[] => [...items].sort((a, b) => a.sortOrder - b.sortOrder);

const dedupeByUrl = (items: PublicProductMedia[]): PublicProductMedia[] => {
  const seen = new Set<string>();
  const out: PublicProductMedia[] = [];
  for (const item of items) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
};

export const ProductGalleryVertical = ({ product }: ProductGalleryVerticalProps) => {
  const fallback = useMemo(() => getNeutralProductMedia(productMediaCategory(product)), [product]);
  const images = useMemo(() => {
    const sorted = sortByOrder(product.gallery ?? []);
    return dedupeByUrl(sorted);
  }, [product.gallery]);

  const primary = product.primaryImage
    ?? product.image
    ?? images[0]?.url
    ?? fallback;

  const [activeUrl, setActiveUrl] = useState<string>(primary);

  useEffect(() => {
    queueMicrotask(() => setActiveUrl(primary));
  }, [primary]);

  const thumbs = images.length > 0 ? images : (primary ? [{ id: 'primary', url: primary, alt: product.name, sortOrder: 0 } as PublicProductMedia] : []);

  return (
    <div className="pdp-gallery">
      <div className="pdp-gallery-main" role="img" aria-label={product.name}>
        {activeUrl ? (
          <img src={activeUrl} alt={product.name} className="pdp-gallery-main-img" loading="eager" />
        ) : (
          <div className="pdp-gallery-main-placeholder" aria-hidden="true">
            <ImageIcon size={48} />
          </div>
        )}
      </div>
      {thumbs.length > 1 && (
        <div className="pdp-gallery-thumbs" role="tablist" aria-label="Ảnh sản phẩm">
          {thumbs.map((image, index) => (
            <button
              key={`${image.id}-${index}`}
              type="button"
              role="tab"
              aria-selected={image.url === activeUrl}
              className={`pdp-gallery-thumb${image.url === activeUrl ? ' is-active' : ''}`}
              onClick={() => setActiveUrl(image.url)}
              aria-label={`Xem ảnh ${index + 1}`}
            >
              <img src={image.url} alt={image.alt || product.name} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGalleryVertical;
