import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Trash2, Minus, Plus, CreditCard, ShoppingBag } from 'lucide-react';
import './CartDrawer.css';

export const CartDrawer: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, clearCart, isCartOpen, setIsCartOpen, triggerNotification } = useApp();
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [shippingAddress, setShippingAddress] = useState({
    address: '',
    city: '',
    district: '',
    ward: '',
  });

  if (!isCartOpen) return null;

  // Format currency helper
  const formatPrice = (price: number) => {
    return `${price.toLocaleString('vi-VN')}đ`;
  };

  // Sum all items (all are now in VND)
  const totalInVND = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Apply promo discount
  const discountedTotalVND = totalInVND * (1 - discount);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    try {
      const res = await fetch(`/api/promos/validate/${encodeURIComponent(promoCode.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setDiscount(data.discount);
        setPromoApplied(true);
        triggerNotification(`Áp dụng mã giảm giá ${Math.round(data.discount * 100)}% thành công!`, 'success');
      } else {
        triggerNotification('Mã giảm giá không hợp lệ hoặc đã hết hạn!', 'error');
      }
    } catch (err) {
      console.error('Failed to validate promo code:', err);
      triggerNotification('Gặp lỗi khi xác thực mã giảm giá!', 'error');
    }
  };

  const hasPhysicalItem = cart.some((item) => item.type === 'physical' || item.simType === 'physical');

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutForm.name || !checkoutForm.email || !checkoutForm.phone) {
      triggerNotification('Vui lòng điền đầy đủ thông tin thanh toán!', 'error');
      return;
    }
    if (hasPhysicalItem && (!shippingAddress.address || !shippingAddress.city || !shippingAddress.district || !shippingAddress.ward)) {
      triggerNotification('Vui lòng điền đầy đủ địa chỉ giao hàng cho SIM vật lý!', 'error');
      return;
    }
    setIsCheckingOut(true);

    try {
      const promises = cart.map(async (item) => {
        const baseProductId = item.id.includes('-pkg-') ? item.id.split('-pkg-')[0] : item.id;
        const response = await fetch('/api/payment/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: baseProductId,
            qty: item.quantity,
            email: checkoutForm.email,
            shippingAddress: {
              name: checkoutForm.name,
              phone: checkoutForm.phone,
              address: shippingAddress.address,
              city: shippingAddress.city,
              district: shippingAddress.district,
              ward: shippingAddress.ward
            }
          })
        });
        return response.ok;
      });
      await Promise.all(promises);
    } catch (err) {
      console.warn('Payment webhook connection failed:', err);
    }

    setTimeout(() => {
      if (hasPhysicalItem) {
        triggerNotification('Đặt hàng thành công! Đơn hàng SIM vật lý đang chờ chuẩn bị giao hàng.', 'success');
      } else {
        triggerNotification('Thanh toán thành công! Mã QR kích hoạt eSIM đã được gửi vào email của bạn.', 'success');
      }
      clearCart();
      setIsCheckingOut(false);
      setIsCartOpen(false);
      setPromoCode('');
      setPromoApplied(false);
      setDiscount(0);
      setShippingAddress({
        address: '',
        city: '',
        district: '',
        ward: '',
      });
    }, 1500);
  };

  return (
    <>
      <div className="cart-drawer-overlay" onClick={() => setIsCartOpen(false)} />
      <div className="cart-drawer open">
        <div className="cart-drawer-header">
          <div className="cart-header-title">
            <ShoppingBag size={22} className="orange-icon" />
            <h2>Giỏ hàng của bạn</h2>
          </div>
          <button className="icon-btn" onClick={() => setIsCartOpen(false)}>
            <X size={24} />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty-state">
            <div className="empty-cart-circle">
              <ShoppingBag size={48} />
            </div>
            <p className="empty-text-title">Giỏ hàng của bạn còn trống</p>
            <p className="empty-text-desc">Hãy chọn các gói eSIM hoặc thiết bị mạng để trải nghiệm kết nối siêu tốc.</p>
            <button className="shop-now-btn" onClick={() => setIsCartOpen(false)}>
              Khám phá ngay
            </button>
          </div>
        ) : (
          <>
            <div className="cart-items-list">
              {cart.map((item) => (
                <div key={item.id} className="cart-item-card">
                  <div className="cart-item-info">
                    <div className="cart-item-header-info">
                      <span className={`item-type-badge ${item.type}`}>
                        {item.type === 'esim' ? 'eSIM' : 'Thiết bị'}
                      </span>
                      <h3>{item.name}</h3>
                    </div>
                    {item.type === 'esim' && (
                      <p className="cart-item-specs">
                        {item.dataLimit} • {item.duration}
                      </p>
                    )}
                    <p className="cart-item-price">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                  
                  <div className="cart-item-actions">
                    <div className="quantity-controller">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="quantity-btn"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="quantity-val">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="quantity-btn"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="delete-item-btn"
                      title="Xóa sản phẩm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount Promo Code Form */}
            <div className="promo-section">
              {promoApplied ? (
                <div className="promo-applied-badge">
                  <span>Mã giảm giá đã áp dụng (Giảm {(discount * 100)}%)</span>
                  <button onClick={() => { setDiscount(0); setPromoApplied(false); }} className="remove-promo-btn">
                    Hủy
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="promo-form">
                  <input
                    type="text"
                    placeholder="Nhập mã giảm giá (HICO50 hoặc HICONEW)"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="promo-input"
                  />
                  <button type="submit" className="promo-btn">
                    Áp dụng
                  </button>
                </form>
              )}
            </div>

            {/* Summary Section */}
            <div className="cart-summary">
              <div className="summary-row">
                <span>Tạm tính</span>
                <span>{formatPrice(totalInVND)}</span>
              </div>
              {discount > 0 && (
                <div className="summary-row discount">
                  <span>Giảm giá ({(discount * 100)}%)</span>
                  <span>
                    -{formatPrice(totalInVND * discount)}
                  </span>
                </div>
              )}
              <div className="summary-row total">
                <span>Tổng cộng</span>
                <div className="total-prices">
                  <span className="primary-total">
                    {formatPrice(discountedTotalVND)}
                  </span>
                </div>
              </div>

              {/* Checkout Form */}
              <form onSubmit={handleCheckoutSubmit} className="checkout-form">
                <div className="checkout-title">
                  <CreditCard size={16} />
                  <span>Thông tin thanh toán</span>
                </div>
                <input
                  type="text"
                  placeholder="Họ và tên của bạn"
                  required
                  value={checkoutForm.name}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                  className="checkout-input"
                />
                <input
                  type="email"
                  placeholder="Email nhận mã QR eSIM"
                  required
                  value={checkoutForm.email}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                  className="checkout-input"
                />
                <input
                  type="tel"
                  placeholder="Số điện thoại liên hệ"
                  required
                  value={checkoutForm.phone}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                  className="checkout-input"
                />

                {hasPhysicalItem && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', borderTop: '1px dashed #cbd5e0', paddingTop: '12px' }}>
                    <div className="checkout-title" style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2b6cb0' }}>Địa chỉ giao SIM Vật lý</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Số nhà, tên đường chi tiết"
                      required={hasPhysicalItem}
                      value={shippingAddress.address}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
                      className="checkout-input"
                    />
                    <input
                      type="text"
                      placeholder="Phường / Xã"
                      required={hasPhysicalItem}
                      value={shippingAddress.ward}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, ward: e.target.value })}
                      className="checkout-input"
                    />
                    <input
                      type="text"
                      placeholder="Quận / Huyện"
                      required={hasPhysicalItem}
                      value={shippingAddress.district}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, district: e.target.value })}
                      className="checkout-input"
                    />
                    <input
                      type="text"
                      placeholder="Tỉnh / Thành phố"
                      required={hasPhysicalItem}
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                      className="checkout-input"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isCheckingOut}
                  className="checkout-btn"
                >
                  {isCheckingOut ? 'Đang xử lý...' : 'Thanh toán ngay'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </>
  );
};
