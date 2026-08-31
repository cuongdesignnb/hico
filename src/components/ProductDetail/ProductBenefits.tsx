import { Globe, Headphones, Mail, Zap } from 'lucide-react';
import type { PublicProduct, PublicVariant } from '../../types/publicCatalog';
import { featureHotspotLabel, featureSpeedLabel } from '../../adapters/productDetailViewModel';

interface ProductBenefitsProps {
  product: PublicProduct;
  variant: PublicVariant | null;
}

interface BenefitCell {
  icon: typeof Globe;
  title: string;
  desc: string;
}

const buildBenefits = (product: PublicProduct, variant: PublicVariant | null): BenefitCell[] => {
  const isPhysical = variant?.fulfillmentMethod === 'HICO_PHYSICAL_STOCK'
    || variant?.fulfillmentMethod === 'WORLDMOVE_PHYSICAL_ORDER';
  const hotspot = featureHotspotLabel(product, variant);
  const speed = featureSpeedLabel(product, variant);

  const cells: BenefitCell[] = [
    {
      icon: Mail,
      title: isPhysical ? 'Giao hàng tận nơi' : 'Nhận eSIM tức thì',
      desc: isPhysical
        ? 'Đơn hàng được giao theo địa chỉ đã chọn.'
        : 'Nhận eSIM và kết nối ngay chỉ trong vài phút.',
    },
    {
      icon: Globe,
      title: hotspot ? 'Không roaming' : 'Kết nối ổn định',
      desc: hotspot ?? 'Kết nối internet local, không phát sinh cước roaming.',
    },
    {
      icon: Headphones,
      title: 'Hỗ trợ 24/7',
      desc: 'Đội ngũ hỗ trợ người Việt mọi lúc mọi nơi.',
    },
    {
      icon: Zap,
      title: speed ? `${speed} nhanh chóng` : 'Kích hoạt dễ dàng',
      desc: speed
        ? `Tốc độ ${speed} cho trải nghiệm mượt mà.`
        : 'Quét mã QR và kết nối chỉ với vài bước đơn giản.',
    },
  ];

  return cells;
};

export const ProductBenefits = ({ product, variant }: ProductBenefitsProps) => {
  const cells = buildBenefits(product, variant);

  return (
    <section className="pdp-benefits" aria-label="Lợi ích sản phẩm">
      {cells.map(({ icon: Icon, title, desc }) => (
        <div key={title} className="pdp-benefit-cell">
          <Icon size={22} className="pdp-benefit-icon" aria-hidden="true" />
          <div className="pdp-benefit-text">
            <span className="pdp-benefit-title">{title}</span>
            <span className="pdp-benefit-desc">{desc}</span>
          </div>
        </div>
      ))}
    </section>
  );
};

export default ProductBenefits;
