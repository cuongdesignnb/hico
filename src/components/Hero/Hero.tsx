import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Globe, Shield, Zap, Headphones, Compass, MapPin } from 'lucide-react';
import './Hero.css';

interface Slide {
  id: string;
  titleHtml: React.ReactNode;
  subtitle: string;
  badge: string;
  searchQuery: string;
  phoneDetails: {
    flag: string;
    countryName: string;
    network: string;
    dataLimit: string;
    duration: string;
    price: string;
  };
  image: string;
  bgGradient: string;
  cartItem: {
    id: string;
    name: string;
    type: 'esim' | 'device';
    price: number;
    duration: string;
    dataLimit: string;
  };
}

const SLIDES: Slide[] = [
  {
    id: 'slide-global',
    titleHtml: <>Kết nối toàn cầu<br />Không giới hạn<br />cùng <span className="text-orange">HICO eSIM</span></>,
    subtitle: 'Nhanh chóng, dễ dàng và tin cậy tại 200+ quốc gia. Không cần SIM vật lý. Không roaming. Chỉ cần quét và kết nối.',
    badge: 'Gói phổ biến toàn cầu 🌐',
    searchQuery: 'Toàn cầu',
    phoneDetails: {
      flag: '🌐',
      countryName: 'Gói Toàn Cầu',
      network: 'Mạng: 200+ Đối tác',
      dataLimit: '10 GB',
      duration: '30 Ngày',
      price: '1.490.000đ',
    },
    image: '/images/art_travel_tips.png',
    bgGradient: 'radial-gradient(100% 100% at 50% 0%, rgba(255, 79, 0, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
    cartItem: {
      id: 'global-esim',
      name: 'Gói Toàn Cầu',
      type: 'esim',
      price: 1490000,
      duration: '30 Ngày',
      dataLimit: '10 GB',
    }
  },
  {
    id: 'slide-japan',
    titleHtml: <>Khám phá Nhật Bản<br />Mạng Docomo 5G<br />cực nhanh cùng <span className="text-orange">HICO</span></>,
    subtitle: 'Tận hưởng kết nối internet tốc độ cao, không gián đoạn từ Tokyo đến Kyoto. Nhận mã QR kích hoạt tức thì qua Email.',
    badge: 'Gói bán chạy nhất 🇯🇵',
    searchQuery: 'Nhật Bản',
    phoneDetails: {
      flag: '🇯🇵',
      countryName: 'eSIM Nhật Bản',
      network: 'Mạng: NTT Docomo',
      dataLimit: '10 GB',
      duration: '15 Ngày',
      price: '490.000đ',
    },
    image: '/images/dest_japan.png',
    bgGradient: 'radial-gradient(100% 100% at 50% 0%, rgba(239, 68, 68, 0.04) 0%, rgba(255, 255, 255, 0) 100%)',
    cartItem: {
      id: 'jp-esim',
      name: 'eSIM Nhật Bản (Docomo)',
      type: 'esim',
      price: 490000,
      duration: '15 Ngày',
      dataLimit: '10 GB',
    }
  },
  {
    id: 'slide-usa',
    titleHtml: <>Du lịch Hoa Kỳ<br />Mạng T-Mobile 5G<br />cực mạnh cùng <span className="text-orange">HICO</span></>,
    subtitle: 'Khám phá New York, California và toàn bộ nước Mỹ với eSIM tốc độ cao. Không lo mất mạng hay phí roaming đắt đỏ.',
    badge: 'Khuyên dùng cho Mỹ 🇺🇸',
    searchQuery: 'Hoa Kỳ',
    phoneDetails: {
      flag: '🇺🇸',
      countryName: 'eSIM Hoa Kỳ',
      network: 'Mạng: T-Mobile / AT&T',
      dataLimit: '20 GB',
      duration: '30 Ngày',
      price: '740.000đ',
    },
    image: '/images/dest_usa.png',
    bgGradient: 'radial-gradient(100% 100% at 50% 0%, rgba(59, 130, 246, 0.04) 0%, rgba(255, 255, 255, 0) 100%)',
    cartItem: {
      id: 'us-esim',
      name: 'eSIM Hoa Kỳ (T-Mobile)',
      type: 'esim',
      price: 740000,
      duration: '30 Ngày',
      dataLimit: '20 GB',
    }
  }
];

export const Hero: React.FC = () => {
  const { setSearchQuery, addToCart } = useApp();
  const [localSearch, setLocalSearch] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFading, setIsFading] = useState(false);
  
  const fadeTimeoutRef = useRef<any>(null);
  const autoRotateIntervalRef = useRef<any>(null);

  const activeSlide = SLIDES[currentSlide];

  // Auto-rotation of slides
  useEffect(() => {
    startAutoRotate();
    return () => {
      stopAutoRotate();
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  const startAutoRotate = () => {
    stopAutoRotate();
    autoRotateIntervalRef.current = setInterval(() => {
      triggerSlideChange((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
  };

  const stopAutoRotate = () => {
    if (autoRotateIntervalRef.current) {
      clearInterval(autoRotateIntervalRef.current);
    }
  };

  const triggerSlideChange = (nextIndexOrFn: number | ((prev: number) => number)) => {
    setIsFading(true);
    fadeTimeoutRef.current = setTimeout(() => {
      if (typeof nextIndexOrFn === 'function') {
        setCurrentSlide(nextIndexOrFn);
      } else {
        setCurrentSlide(nextIndexOrFn);
      }
      setIsFading(false);
    }, 300); // match CSS transition time
  };

  const handleIndicatorClick = (idx: number) => {
    stopAutoRotate();
    triggerSlideChange(idx);
    startAutoRotate();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localSearch.trim()) return;
    setSearchQuery(localSearch);
    
    // Smooth scroll to destinations section
    const destinationsSec = document.getElementById('destinations-and-packages');
    if (destinationsSec) {
      destinationsSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleQuickSearch = (query: string) => {
    setLocalSearch(query);
    setSearchQuery(query);
    const destinationsSec = document.getElementById('destinations-and-packages');
    if (destinationsSec) {
      destinationsSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddToCartDemo = () => {
    addToCart(activeSlide.cartItem);
  };

  return (
    <section className="hero-section" style={{ background: activeSlide.bgGradient, transition: 'background 0.5s ease' }}>
      {/* Background Graphic Lines & Landmarks */}
      <div className="hero-background-graphic">
        <svg viewBox="0 0 1000 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="network-svg">
          {/* Network Connection Lines */}
          <path d="M 100 150 Q 300 100 500 200 T 900 150" stroke="#FF4F00" strokeWidth="1" strokeDasharray="5 5" opacity="0.25" />
          <path d="M 50 350 Q 250 450 600 300 T 950 400" stroke="#FF4F00" strokeWidth="1" strokeDasharray="5 5" opacity="0.15" />
          <circle cx="300" cy="100" r="4" fill="#FF4F00" opacity="0.5" className="pulse-dot" />
          <circle cx="500" cy="200" r="5" fill="#FF4F00" opacity="0.6" className="pulse-dot" />
          <circle cx="600" cy="300" r="4" fill="#FF4F00" opacity="0.4" className="pulse-dot" />
          <circle cx="750" cy="180" r="6" fill="#FF4F00" opacity="0.7" className="pulse-dot" />

          {/* Travel Landmarks Silhouette Watermark */}
          <g opacity="0.05" fill="#FF4F00">
            {/* Eiffel Tower */}
            <path d="M 420,480 L 445,480 C 442,410 439,360 436,290 L 439,290 L 439,275 L 434,275 L 431,180 L 429,180 L 426,275 L 421,275 L 421,290 L 424,290 C 421,360 418,410 415,480 L 420,480 A 12,12 0 0,1 432,470 A 12,12 0 0,1 445,480 Z" />
            <rect x="422" y="350" width="16" height="5" />
            <rect x="425" y="300" width="10" height="4" />

            {/* Big Ben */}
            <path d="M 680,480 L 705,480 L 705,290 L 702,285 L 702,255 L 698,250 L 698,210 L 693,205 L 693,160 L 691,160 L 691,205 L 686,210 L 686,250 L 682,255 L 682,285 L 678,290 Z M 687,265 A 5,5 0 1,1 697,265 A 5,5 0 1,1 687,265 Z" />

            {/* Airplane */}
            <path d="M 830,120 L 865,100 L 862,110 L 880,115 L 862,120 L 865,130 L 852,122 L 830,125 Z" transform="rotate(-12, 850, 115)" />
          </g>
        </svg>
      </div>

      <div className="container hero-container">
        {/* Left Side: Copy and Search */}
        <div className={`hero-content ${isFading ? 'slide-fade-out' : 'slide-fade-in'}`}>
          {/* Active slide badge */}
          <span className="hero-slide-badge">{activeSlide.badge}</span>
          
          <h1 className="hero-title">
            {activeSlide.titleHtml}
          </h1>
          <p className="hero-subtitle">
            {activeSlide.subtitle}
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="hero-search-bar">
            <div className="search-input-wrapper">
              <MapPin className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Bạn muốn đến đâu?"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="hero-search-input"
              />
            </div>
            <button type="submit" className="hero-search-btn">
              Tìm kiếm
            </button>
          </form>

          {/* Slide Indicators */}
          <div className="hero-slide-indicators">
            {SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                className={`slide-indicator ${currentSlide === idx ? 'active' : ''}`}
                onClick={() => handleIndicatorClick(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Quick links */}
          <div className="hero-quick-actions">
            <button
              onClick={() => handleQuickSearch('')}
              className="quick-btn primary"
            >
              Xem tất cả điểm đến
            </button>
            <button
              onClick={() => handleQuickSearch(activeSlide.searchQuery)}
              className="quick-btn secondary"
            >
              <Compass size={16} />
              <span>Khám phá {activeSlide.searchQuery}</span>
            </button>
          </div>

          {/* Trust badges */}
          <div className="hero-trust-badges">
            <div className="trust-badge">
              <div className="badge-icon-box">
                <Globe size={20} />
              </div>
              <div className="badge-text">
                <span className="badge-num">200+</span>
                <span className="badge-label">Quốc gia</span>
              </div>
            </div>
            <div className="trust-badge">
              <div className="badge-icon-box">
                <Shield size={20} />
              </div>
              <div className="badge-text">
                <span className="badge-num">Giá tốt nhất</span>
                <span className="badge-label">Cam kết</span>
              </div>
            </div>
            <div className="trust-badge">
              <div className="badge-icon-box">
                <Zap size={20} />
              </div>
              <div className="badge-text">
                <span className="badge-num">Giao hàng</span>
                <span className="badge-label">Tức thì</span>
              </div>
            </div>
            <div className="trust-badge">
              <div className="badge-icon-box">
                <Headphones size={20} />
              </div>
              <div className="badge-text">
                <span className="badge-num">Hỗ trợ</span>
                <span className="badge-label">24/7</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Travel Photo Slide display */}
        <div className={`hero-mockup-wrapper ${isFading ? 'slide-fade-out' : 'slide-fade-in'}`}>
          <div className="hero-slide-image-wrapper">
            <div className="hero-slide-image-card">
              <img
                src={activeSlide.image}
                alt={activeSlide.phoneDetails.countryName}
                className="hero-slide-image"
                onError={(e) => {
                  (e.target as HTMLImageElement).onerror = null;
                  (e.target as HTMLImageElement).src = '/images/dest_japan.png';
                }}
              />
              <div className="hero-slide-image-overlay"></div>
              
              {/* Floating info tag */}
              <div className="hero-slide-floating-tag glass-panel">
                <span className="tag-flag">{activeSlide.phoneDetails.flag}</span>
                <div className="tag-meta">
                  <strong>{activeSlide.phoneDetails.countryName}</strong>
                  <span>Chỉ từ {activeSlide.phoneDetails.price}</span>
                </div>
                
                {/* Buy button */}
                <button className="tag-buy-btn" onClick={handleAddToCartDemo}>
                  Mua ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
