import type { PublicProduct } from '../../types/publicCatalog';

export const ProductHeader = ({ product }: { product: PublicProduct }) => (
  <header className="canonical-product-header">
    <p className="product-kicker">{product.operation === 'device_sale' ? 'Thiết bị' : product.operation === 'topup' ? 'Top-up' : 'Kết nối du lịch'}</p>
    <h1>{product.name}</h1>
    <p>{product.seo.description || product.description || 'Thông tin sản phẩm canonical của HICO.'}</p>
  </header>
);
