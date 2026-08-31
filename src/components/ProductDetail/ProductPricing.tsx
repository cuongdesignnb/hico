import type { PublicVariant } from '../../types/publicCatalog';

export const ProductPricing = ({ variant }: { variant: PublicVariant | null }) => variant ? <div className="canonical-product-pricing"><span>Giá</span><strong>{variant.price.toLocaleString('vi-VN')} {variant.currency}</strong>{variant.compareAtPrice && variant.compareAtPrice > variant.price && <del>{variant.compareAtPrice.toLocaleString('vi-VN')} {variant.currency}</del>}</div> : null;
