import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRight, Wifi } from 'lucide-react';
import './Destinations.css';

interface Destination {
  id: string;
  name: string;
  flag: string;
  dataLimit: string;
  duration: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  network: string;
}

const FALLBACK_DESTINATIONS: Destination[] = [
  {
    id: 'jp-esim',
    name: 'Nhật Bản',
    flag: '🇯🇵',
    dataLimit: '10 GB',
    duration: '15 Ngày',
    price: 490000,
    compareAtPrice: 620000,
    image: '/images/dest_japan.png',
    network: 'NTT Docomo / SoftBank',
  },
  {
    id: 'us-esim',
    name: 'Hoa Kỳ',
    flag: '🇺🇸',
    dataLimit: '20 GB',
    duration: '30 Ngày',
    price: 740000,
    compareAtPrice: 990000,
    image: '/images/dest_usa.png',
    network: 'T-Mobile / AT&T',
  },
  {
    id: 'th-esim',
    name: 'Thái Lan',
    flag: '🇹🇭',
    dataLimit: '10 GB',
    duration: '15 Ngày',
    price: 390000,
    compareAtPrice: 490000,
    image: '/images/dest_thailand.png',
    network: 'AIS / TrueMove',
  },
  {
    id: 'uk-esim',
    name: 'Vương Quốc Anh',
    flag: '🇬🇧',
    dataLimit: '10 GB',
    duration: '15 Ngày',
    price: 440000,
    compareAtPrice: 570000,
    image: '/images/dest_uk.png',
    network: 'EE / Vodafone',
  },
  {
    id: 'sg-esim',
    name: 'Singapore',
    flag: '🇸🇬',
    dataLimit: '10 GB',
    duration: '15 Ngày',
    price: 420000,
    compareAtPrice: 540000,
    image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=80&w=400&auto=format&fit=crop',
    network: 'Singtel / StarHub',
  },
  {
    id: 'kr-esim',
    name: 'Hàn Quốc',
    flag: '🇰🇷',
    dataLimit: '15 GB',
    duration: '20 Ngày',
    price: 570000,
    compareAtPrice: 690000,
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=400&auto=format&fit=crop',
    network: 'SK Telecom / KT',
  },
  {
    id: 'fr-esim',
    name: 'Pháp',
    flag: '🇫🇷',
    dataLimit: '20 GB',
    duration: '30 Ngày',
    price: 690000,
    compareAtPrice: 820000,
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=400&auto=format&fit=crop',
    network: 'Orange / SFR',
  },
  {
    id: 'au-esim',
    name: 'Australia',
    flag: '🇦🇺',
    dataLimit: '30 GB',
    duration: '30 Ngày',
    price: 870000,
    compareAtPrice: 990000,
    image: 'https://images.unsplash.com/photo-1523482596682-cd93a6e94dd4?q=80&w=400&auto=format&fit=crop',
    network: 'Telstra / Optus',
  }
];

export const Destinations: React.FC = () => {
  const { searchQuery, setSearchQuery } = useApp();
  const [destinations, setDestinations] = useState<Destination[]>(FALLBACK_DESTINATIONS);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/admin/destinations')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Server returned error');
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setDestinations(data);
        }
      })
      .catch(() => {
        // Fallback silently to static list
      });
  }, []);

  const handleCardClick = (destId: string) => {
    window.location.hash = `#/product/${destId}`;
  };

  // Filter based on search query
  const filteredDestinations = destinations.filter((dest) =>
    dest.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show only first 8 by default to match landing page, show all if showAll or searchQuery is active
  const displayedDestinations = (showAll || searchQuery) ? filteredDestinations : filteredDestinations.slice(0, 8);

  return (
    <div className="destinations-block">
      {/* Section Header */}
      <div className="section-title-wrapper">
        <div>
          <h2 className="section-title">Điểm đến phổ biến</h2>
        </div>
        {(searchQuery || showAll) ? (
          <button className="clear-search-btn" onClick={() => { setSearchQuery(''); setShowAll(false); }}>
            Thu gọn
          </button>
        ) : (
          <a href="#" className="section-view-all" onClick={(e) => { e.preventDefault(); setShowAll(true); }}>
            Xem tất cả <ArrowRight size={16} />
          </a>
        )}
      </div>

      {/* Search Results Summary */}
      {searchQuery && (
        <div className="search-query-badge">
          Kết quả cho: <strong>"{searchQuery}"</strong> ({filteredDestinations.length})
        </div>
      )}

      {/* Grid List */}
      {displayedDestinations.length === 0 ? (
        <div className="no-destinations-state">
          <Wifi size={40} className="no-results-icon" />
          <h3>Không tìm thấy quốc gia của bạn?</h3>
          <p>Chúng tôi đang cập nhật thêm quốc gia mới.</p>
          <button className="reset-search-btn" onClick={() => { setSearchQuery(''); setShowAll(false); }}>
            Quay lại
          </button>
        </div>
      ) : (
        <div className="destinations-grid">
          {displayedDestinations.map((dest) => {
            const discountPercent = dest.compareAtPrice && dest.compareAtPrice > dest.price
              ? Math.round(((dest.compareAtPrice - dest.price) / dest.compareAtPrice) * 100)
              : 0;

            return (
              <div key={dest.id} className="destination-card" onClick={() => handleCardClick(dest.id)}>
                {/* Image Header */}
                <div className="dest-image-box" style={{ position: 'relative' }}>
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="dest-image"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).onerror = null;
                      (e.target as HTMLImageElement).src = '/images/dest_japan.png';
                    }}
                  />
                  {discountPercent > 0 && (
                    <span className="dest-badge-overlay sale" style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      backgroundColor: 'var(--primary-orange)',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      zIndex: 1
                    }}>
                      -{discountPercent}%
                    </span>
                  )}
                </div>

                {/* Body Details */}
                <div className="dest-details">
                  <h3 className="dest-name">
                    <span className="flag-circle-inline">{dest.flag}</span>
                    <span>{dest.name}</span>
                  </h3>
                  <div className="dest-specs">
                    <span>{dest.dataLimit}</span>
                    <span className="specs-dot">•</span>
                    <span>{dest.duration}</span>
                  </div>
                  
                  <div className="dest-footer">
                    <div className="dest-price-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      {dest.compareAtPrice !== undefined && dest.compareAtPrice > 0 && dest.compareAtPrice > dest.price && (
                        <span className="dest-compare-at-price" style={{ textDecoration: 'line-through', color: '#9CA3AF', fontSize: '0.85em', marginBottom: '2px' }}>
                          {dest.compareAtPrice.toLocaleString('vi-VN')}đ
                        </span>
                      )}
                      <span className="dest-price">{dest.price.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div
                      className="dest-action-btn"
                      title="Chọn gói cước"
                    >
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
