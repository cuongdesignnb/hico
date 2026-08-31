import type { PublicProduct, PublicVariant } from '../../types/publicCatalog';

export const ProductAvailability = ({ product, variant }: { product: PublicProduct; variant: PublicVariant | null }) => {
  if (!variant) return <p className="canonical-route-error">Sản phẩm chưa có biến thể public khả dụng.</p>;
  const physical = variant.medium === 'physical_sim' || product.operation === 'device_sale';
  return <div className="canonical-availability"><strong>{variant.availability.inStock ? 'Còn hàng' : 'Hết hàng'}</strong><span>{physical ? 'Cần thông tin giao hàng khi checkout.' : variant.requiresExistingSim ? 'Cần SIM hiện hữu để nạp thêm.' : 'Kích hoạt theo fulfillment của biến thể.'}</span></div>;
};
