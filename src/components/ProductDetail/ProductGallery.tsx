import { getProductImages, getProductMedia } from '../../utils/productMedia';
import type { PublicProduct } from '../../types/publicCatalog';

export const ProductGallery = ({ product }: { product: PublicProduct }) => {
  const images = getProductImages(product);
  return <div className="canonical-product-gallery"><img src={getProductMedia(product)} alt={product.name} /><div className="canonical-product-thumbnails">{images.map((image) => <img key={image} src={image} alt="" loading="lazy" />)}</div></div>;
};
