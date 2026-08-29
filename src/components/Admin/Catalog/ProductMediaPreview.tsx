import { Image as ImageIcon } from 'lucide-react';
import type { CatalogProductRecord } from '../../../types/catalog';

interface ProductMediaPreviewProps {
  product: CatalogProductRecord;
}

const ProductMediaPreview = ({ product }: ProductMediaPreviewProps) => {
  return (
    <div className="catalog-preview-media">
      <div className="catalog-preview-media__primary">
        <span className="catalog-preview-media__label">Ảnh chính</span>
        {product.image ? (
          <div className="catalog-preview-media__primary-image">
            <img src={product.image} alt={product.name} />
          </div>
        ) : (
          <div className="catalog-preview-media__placeholder">
            <ImageIcon size={28} />
            <span>Chưa có ảnh</span>
          </div>
        )}
      </div>

      <div className="catalog-preview-media__hint">
        Sử dụng Product Wizard để cập nhật ảnh sản phẩm.
      </div>
    </div>
  );
};

export default ProductMediaPreview;
