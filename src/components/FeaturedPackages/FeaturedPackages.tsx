import React, { useState, useEffect } from 'react';
import { ArrowRight, Globe, Map } from 'lucide-react';
import './FeaturedPackages.css';

interface Package {
  id: string;
  name: string;
  coverage: string;
  dataLimit: string;
  duration: string;
  price: number;
  compareAtPrice?: number;
  iconType: 'region' | 'global';
}

const FALLBACK_PACKAGES: Package[] = [
  {
    id: 'asia-pacific-esim',
    name: 'Gói Châu Á - Thái Bình Dương',
    coverage: '12 Quốc gia',
    dataLimit: '20 GB',
    duration: '30 Ngày',
    price: 990000,
    compareAtPrice: 1240000,
    iconType: 'region',
  },
  {
    id: 'global-esim',
    name: 'Gói Toàn Cầu',
    coverage: '200+ Quốc gia',
    dataLimit: '10 GB',
    duration: '30 Ngày',
    price: 1490000,
    compareAtPrice: 1990000,
    iconType: 'global',
  }
];

export const FeaturedPackages: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>(FALLBACK_PACKAGES);

  useEffect(() => {
    fetch('/api/admin/packages')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Server error');
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPackages(data);
        }
      })
      .catch(() => {
        // Fallback silently
      });
  }, []);

  const handleCardClick = (pkgId: string) => {
    window.location.hash = `#/product/${pkgId}`;
  };

  return (
    <div className="packages-block">
      {/* Section Header */}
      <div className="section-title-wrapper">
        <div>
          <h2 className="section-title">Gói nổi bật</h2>
        </div>
        <a href="#" className="section-view-all" onClick={(e) => e.preventDefault()}>
          Xem tất cả <ArrowRight size={16} />
        </a>
      </div>

      {/* Packages Vertical Stack */}
      <div className="packages-stack">
        {packages.slice(0, 4).map((pkg) => {
          const discountPercent = pkg.compareAtPrice && pkg.compareAtPrice > pkg.price
            ? Math.round(((pkg.compareAtPrice - pkg.price) / pkg.compareAtPrice) * 100)
            : 0;

          return (
            <div key={pkg.id} className="package-horizontal-card" onClick={() => handleCardClick(pkg.id)}>
              {/* Left: Icon */}
              <div className="package-left-icon-box">
                {pkg.iconType === 'region' ? <Map size={20} /> : <Globe size={20} />}
              </div>

              {/* Right: Text & Details */}
              <div className="package-right-details">
                <div className="package-text-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3>{pkg.name}</h3>
                    {discountPercent > 0 && (
                      <span className="pkg-discount-badge" style={{
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        -{discountPercent}%
                      </span>
                    )}
                  </div>
                  <span className="pkg-coverage-text">{pkg.coverage}</span>
                  
                  {/* Modern Pill Badges */}
                  <div className="pkg-badges-row">
                    <span className="pkg-badge duration">{pkg.duration}</span>
                    <span className="pkg-badge data">{pkg.dataLimit}</span>
                  </div>
                </div>
                
                <div className="package-price-arrow-row">
                  <div className="package-price-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {pkg.compareAtPrice !== undefined && pkg.compareAtPrice > 0 && pkg.compareAtPrice > pkg.price && (
                      <span className="pkg-compare-at">
                        {pkg.compareAtPrice.toLocaleString('vi-VN')}đ
                      </span>
                    )}
                    <span className="pkg-price-text">{pkg.price.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="pkg-arrow-btn">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
