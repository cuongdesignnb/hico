import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/useApp';
import { ShoppingCart, Share2, PlusCircle, CheckCircle2, LockKeyhole, Leaf, Award, ChevronDown, ChevronUp } from 'lucide-react';
import './Devices.css';

interface Device {
  id: string;
  name: string;
  category: 'pocket' | 'home' | 'office' | 'usb';
  specs: string[];
  price: number; // in VND
  compareAtPrice?: number;
  stock?: number;
  badge?: string;
  bestSeller?: boolean;
  image?: string;
}

const FALLBACK_DEVICES: Device[] = [
  {
    id: 'device-wifi-mini',
    name: 'Bộ phát WiFi 4G mini HICO',
    category: 'pocket',
    specs: ['Dung lượng Pin 3000mAh', 'Kết nối cùng lúc 10 thiết bị', 'Tốc độ ổn định lên tới 150Mbps'],
    price: 890000,
    compareAtPrice: 1200000,
    stock: 12,
    badge: 'Bán chạy',
    bestSeller: true,
  },
  {
    id: 'device-wifi-home',
    name: 'Router WiFi 4G Gia đình HICO',
    category: 'home',
    specs: ['Cắm SIM dùng trực tiếp', 'Phủ sóng rộng 100m²', 'Hỗ trợ kết nối tối đa 32 thiết bị'],
    price: 1490000,
    compareAtPrice: 1800000,
    stock: 5,
  },
  {
    id: 'device-wifi-5g',
    name: 'Router WiFi 5G Tốc độ cao',
    category: 'office',
    specs: ['Tốc độ 5G cực nhanh', 'Phù hợp làm việc/văn phòng', 'Bảo mật nâng cao WPA3'],
    price: 3990000,
    compareAtPrice: 4500000,
    stock: 0,
    badge: 'Mới',
  },
  {
    id: 'device-usb-4g',
    name: 'USB 4G LTE Đa Năng',
    category: 'usb',
    specs: ['Cắm là chạy tiện lợi', 'Kích thước siêu nhỏ gọn', 'Hỗ trợ đa mạng di động'],
    price: 690000,
    compareAtPrice: 900000,
    stock: 24,
  },
];

export const Devices: React.FC = () => {
  const { addToCart } = useApp();
  const [devices, setDevices] = useState<Device[]>(FALLBACK_DEVICES);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pocket' | 'home' | 'office' | 'usb'>('all');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/admin/devices')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Server error');
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setDevices(data);
        }
      })
      .catch(() => {
        // Fallback silently
      });
  }, []);

  const handleBuy = (device: Device) => {
    if (device.stock !== undefined && device.stock <= 0) return;
    addToCart({
      id: device.id,
      name: device.name,
      type: 'device',
      price: device.price,
    });
  };

  const handleFilterChange = (filter: 'all' | 'pocket' | 'home' | 'office' | 'usb') => {
    setSelectedFilter(filter);
    setShowAll(false);
  };

  const filteredDevices = selectedFilter === 'all'
    ? devices
    : devices.filter(dev => dev.category === selectedFilter);

  const displayedDevices = showAll ? filteredDevices : filteredDevices.slice(0, 4);

  return (
    <section className="section devices-section">
      <div className="container">
        {/* Header Title & Secondary Badges */}
        <div className="devices-header-wrapper">
          <div className="devices-header-title">
            <h2 className="section-title">Thiết bị mạng 4G/5G nổi bật</h2>
            <p className="section-subtitle">
              Router WiFi, bộ phát di động và USB 4G/5G chính hãng, dùng tốt cho du lịch và công tác
            </p>
          </div>

          {/* Quick trust assurances (matching mockup badges with orange checkmarks) */}
          <div className="quick-assurances-row">
            <div className="assurance-badge">
              <CheckCircle2 size={14} className="as-icon" fill="currentColor" color="white" />
              <span>Chính hãng</span>
            </div>
            <div className="assurance-badge">
              <CheckCircle2 size={14} className="as-icon" fill="currentColor" color="white" />
              <span>Bảo hành 12 tháng</span>
            </div>
            <div className="assurance-badge">
              <CheckCircle2 size={14} className="as-icon" fill="currentColor" color="white" />
              <span>Giao hàng toàn quốc</span>
            </div>
            <div className="assurance-badge">
              <CheckCircle2 size={14} className="as-icon" fill="currentColor" color="white" />
              <span>Hỗ trợ cài đặt</span>
            </div>
          </div>
        </div>

        {/* Dynamic Category Filtering Tabs */}
        <div className="devices-filters">
          <button className={`filter-tab ${selectedFilter === 'all' ? 'active' : ''}`} onClick={() => handleFilterChange('all')}>Tất cả</button>
          <button className={`filter-tab ${selectedFilter === 'pocket' ? 'active' : ''}`} onClick={() => handleFilterChange('pocket')}>Bộ phát di động</button>
          <button className={`filter-tab ${selectedFilter === 'home' ? 'active' : ''}`} onClick={() => handleFilterChange('home')}>WiFi gia đình</button>
          <button className={`filter-tab ${selectedFilter === 'office' ? 'active' : ''}`} onClick={() => handleFilterChange('office')}>Thiết bị văn phòng</button>
          <button className={`filter-tab ${selectedFilter === 'usb' ? 'active' : ''}`} onClick={() => handleFilterChange('usb')}>USB 4G</button>
        </div>

        {/* Devices Cards Grid */}
        <div className="devices-grid">
          {displayedDevices.map((dev) => {
            const discountPercent = dev.compareAtPrice && dev.compareAtPrice > dev.price
              ? Math.round(((dev.compareAtPrice - dev.price) / dev.compareAtPrice) * 100)
              : 0;

            return (
              <div key={dev.id} className="device-card">
                {/* Image Box */}
                <div className="device-img-box" style={{ position: 'relative' }}>
                  <img
                    src={dev.image || `/images/${dev.id.replace(/-/g, '_')}.png`}
                    alt={dev.name}
                    className="device-image"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).onerror = null;
                      (e.target as HTMLImageElement).src = '/images/device_wifi_mini.png';
                    }}
                  />
                  {dev.badge && (
                    <span className={`device-badge-overlay ${dev.badge === 'Bán chạy' ? 'hot' : 'new'}`}>
                      {dev.badge}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="device-badge-overlay sale" style={{ backgroundColor: 'var(--primary-orange)', left: dev.badge ? 'auto' : '12px', right: dev.badge ? '12px' : 'auto' }}>
                      -{discountPercent}%
                    </span>
                  )}
                  {dev.stock !== undefined && dev.stock <= 0 && (
                    <div className="out-of-stock-overlay" style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '15px',
                      borderRadius: '12px',
                      backdropFilter: 'blur(2px)',
                      zIndex: 2
                    }}>
                      <span style={{ backgroundColor: '#EF4444', padding: '6px 12px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hết hàng</span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="device-details-box">
                  <h3 className="device-title-text">{dev.name}</h3>
                  
                  {/* Specs Bullets */}
                  <ul className="device-specs-list">
                    {dev.specs.map((spec, sIdx) => (
                      <li key={sIdx}>{spec}</li>
                    ))}
                  </ul>

                  {/* Footer and Price */}
                  <div className="device-card-footer">
                    <div className="device-price-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      {dev.compareAtPrice !== undefined && dev.compareAtPrice > 0 && dev.compareAtPrice > dev.price && (
                        <span className="compare-at-price" style={{ textDecoration: 'line-through', color: '#9CA3AF', fontSize: '0.85em', marginBottom: '2px' }}>
                          {dev.compareAtPrice.toLocaleString('vi-VN')}đ
                        </span>
                      )}
                      <span className="price-tag">{dev.price.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <button
                      className={`device-buy-btn ${dev.stock !== undefined && dev.stock <= 0 ? 'disabled' : ''}`}
                      onClick={() => handleBuy(dev)}
                      disabled={dev.stock !== undefined && dev.stock <= 0}
                      style={dev.stock !== undefined && dev.stock <= 0 ? { backgroundColor: '#9CA3AF', cursor: 'not-allowed' } : {}}
                    >
                      <ShoppingCart size={16} />
                      <span>{dev.stock !== undefined && dev.stock <= 0 ? 'Hết hàng' : 'Mua ngay'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Toggle show all button */}
        {filteredDevices.length > 4 && (
          <div className="devices-show-more-container">
            <button className="devices-toggle-btn" onClick={() => setShowAll(!showAll)}>
              <span>{showAll ? 'Thu gọn danh sách' : `Xem tất cả (${filteredDevices.length}) thiết bị`}</span>
              {showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        )}

        {/* Bottom Trust Badges in the design */}
        <div className="devices-bottom-assurances">
          <div className="b-assurance">
            <Share2 size={20} className="b-as-icon" />
            <div className="b-as-text">
              <strong>Chia sẻ dữ liệu</strong>
              <span>Cho nhiều thiết bị cùng lúc</span>
            </div>
          </div>
          <div className="b-assurance">
            <PlusCircle size={20} className="b-as-icon" />
            <div className="b-as-text">
              <strong>Nạp gói dễ dàng</strong>
              <span>Nạp thêm dung lượng bất cứ lúc nào</span>
            </div>
          </div>
          <div className="b-assurance">
            <CheckCircle2 size={20} className="b-as-icon" />
            <div className="b-as-text">
              <strong>Gia hạn linh hoạt</strong>
              <span>Kéo dài thời hạn khi cần thiết</span>
            </div>
          </div>
          <div className="b-assurance">
            <Award size={20} className="b-as-icon" />
            <div className="b-as-text">
              <strong>Hoàn tiền đảm bảo</strong>
              <span>Hoàn tiền 100% nếu không sử dụng được</span>
            </div>
          </div>
          <div className="b-assurance">
            <LockKeyhole size={20} className="b-as-icon" />
            <div className="b-as-text">
              <strong>Bảo mật tuyệt đối</strong>
              <span>Thông tin của bạn luôn được bảo vệ</span>
            </div>
          </div>
          <div className="b-assurance">
            <Leaf size={20} className="b-as-icon" />
            <div className="b-as-text">
              <strong>Thân thiện môi trường</strong>
              <span>Không SIM nhựa, bảo vệ hành tinh</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
