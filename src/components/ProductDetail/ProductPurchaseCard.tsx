import { Minus, Plus, ShieldCheck } from 'lucide-react';
import type { PublicProduct, PublicVariant } from '../../types/publicCatalog';
import {
  discountPercent,
  formatDiscount,
  formatPriceWithCurrency,
} from '../../adapters/productDetailViewModel';
import { getProductMedia } from '../../utils/productMedia';

interface ProductPurchaseCardProps {
  product: PublicProduct;
  variant: PublicVariant | null;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onOpenCart: () => void;
  variantAvailable: boolean;
  addToCartLabel?: string;
  buyNowLabel?: string;
}

export const ProductPurchaseCard = ({
  product,
  variant,
  quantity,
  onQuantityChange,
  onAddToCart,
  onBuyNow,
  variantAvailable,
}: ProductPurchaseCardProps) => {
  const subtotal = variant ? variant.price * quantity : 0;
  const compareTotal = variant?.compareAtPrice ? variant.compareAtPrice * quantity : null;
  const discount = formatDiscount(variant);
  const discountPct = discountPercent(variant);
  const currency = variant?.currency ?? 'VND';
  const image = getProductMedia(product);

  return (
    <aside className="pdp-purchase-card">
      <div className="pdp-purchase-card__header">
        <span className="pdp-purchase-card__tag">Gói đã chọn</span>
      </div>

      <div className="pdp-purchase-card__price">
        {variant && compareTotal && discountPct && discountPct > 0 ? (
          <>
            <div className="pdp-purchase-card__price-row">
              <span className="pdp-purchase-card__price-now">{formatPriceWithCurrency(subtotal, currency)}</span>
              <span className="pdp-purchase-card__discount">{discount}</span>
            </div>
            <span className="pdp-purchase-card__price-old">{formatPriceWithCurrency(compareTotal, currency)}</span>
          </>
        ) : (
          <span className="pdp-purchase-card__price-now">{variant ? formatPriceWithCurrency(subtotal, currency) : '—'}</span>
        )}
      </div>

      <div className="pdp-purchase-card__summary">
        {variant?.dataLimit && (
          <div className="pdp-purchase-card__summary-row">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Dung lượng: <strong>{variant.dataLimit}</strong></span>
          </div>
        )}
        {variant?.duration && (
          <div className="pdp-purchase-card__summary-row">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Thời gian: <strong>{variant.duration}</strong></span>
          </div>
        )}
        {(variant?.speedLabel || product.speedLabel) && (
          <div className="pdp-purchase-card__summary-row">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Tốc độ: <strong>{variant?.speedLabel ?? product.speedLabel}</strong></span>
          </div>
        )}
        {(variant?.networkLabel || product.networkLabel) && (
          <div className="pdp-purchase-card__summary-row">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Mạng: <strong>{variant?.networkLabel ?? product.networkLabel}</strong></span>
          </div>
        )}
      </div>

      <div className="pdp-purchase-card__quantity">
        <span className="pdp-purchase-card__quantity-label">Số lượng</span>
        <div className="pdp-purchase-card__quantity-stepper">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            aria-label="Giảm số lượng"
          >
            <Minus size={14} />
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(Math.min(99, quantity + 1))}
            aria-label="Tăng số lượng"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="pdp-purchase-card__cta">
        <button
          type="button"
          className="pdp-purchase-card__add-to-cart"
          onClick={onAddToCart}
          disabled={!variantAvailable || !variant}
        >
          <img src={image} alt="" aria-hidden="true" />
          <span>Thêm vào giỏ hàng</span>
        </button>
        <button
          type="button"
          className="pdp-purchase-card__buy-now"
          onClick={onBuyNow}
          disabled={!variantAvailable || !variant}
        >
          Mua ngay
        </button>
      </div>

      <div className="pdp-purchase-card__trust">
        <div className="pdp-purchase-card__trust-row">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Thanh toán an toàn & bảo mật</span>
        </div>
        <p className="pdp-purchase-card__trust-note">
          Đơn hàng được xử lý qua cổng thanh toán được cấu hình trong HICO Admin.
        </p>
      </div>
    </aside>
  );
};

export default ProductPurchaseCard;