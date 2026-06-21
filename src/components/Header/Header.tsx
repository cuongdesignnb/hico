import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ShoppingCart, Search, Menu, X, LogIn, ChevronDown } from 'lucide-react';
import './Header.css';

interface HeaderProps {
  onNavClick: (sectionId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavClick }) => {
  const { cart, setIsCartOpen, setSearchQuery, isLoggedIn, setIsLoggedIn, currentUser } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [currency, setCurrency] = useState<'VND' | 'USD'>('VND');

  // Cart total items count
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  // Monitor scroll for header background
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
    
    // If not on landing page, redirect to landing page first
    if (window.location.hash.startsWith('#/product/')) {
      window.location.hash = '';
      setTimeout(() => {
        onNavClick('destinations-and-packages');
      }, 100);
    } else {
      onNavClick('destinations-and-packages');
    }
  };

  const handleNav = (sectionId: string) => {
    onNavClick(sectionId);
    setIsMobileMenuOpen(false);
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (window.location.hash.startsWith('#/product/') || window.location.hash === '#/admin') {
      window.location.hash = '';
    } else {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleCurrency = () => {
    setCurrency(prev => prev === 'VND' ? 'USD' : 'VND');
  };

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container header-container-main">
        {/* Row 1: Logo, Search, Actions */}
        <div className="header-top-row">
          {/* Logo */}
          <a href="/" className="logo-link" onClick={handleLogoClick}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="110" height="36" className="logo-img-svg">
              <defs>
                <linearGradient id="hico-orange" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF6B00" />
                  <stop offset="100%" stopColor="#FF3D00" />
                </linearGradient>
              </defs>
              {/* Text HICO completely orange */}
              <text x="5" y="28" fontFamily="'Outfit', sans-serif" fontWeight="900" fontSize="24" fill="#FF4F00">HIC</text>
              {/* O containing the globe grid inside */}
              <circle cx="63" cy="20" r="9.5" fill="none" stroke="#FF4F00" strokeWidth="2.5" />
              {/* Globe lines inside O */}
              <path d="M57,20 L69,20" stroke="#FF4F00" strokeWidth="1" />
              <path d="M63,11.5 L63,28.5" stroke="#FF4F00" strokeWidth="1" />
              <path d="M58,16 Q63,18 68,16" fill="none" stroke="#FF4F00" strokeWidth="1" />
              <path d="M58,24 Q63,22 68,24" fill="none" stroke="#FF4F00" strokeWidth="1" />
              {/* Curved signal waves to the right of O */}
              <path d="M78,15 A8,8 0 0,1 84,21" fill="none" stroke="#FF4F00" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M78,10 A14,14 0 0,1 89,21" fill="none" stroke="#FF4F00" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M78,5 A20,20 0 0,1 94,21" fill="none" stroke="#FF4F00" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </a>

          {/* Large Static Search Bar in center */}
          <form onSubmit={handleSearchSubmit} className="header-search-form">
            <input
              type="text"
              placeholder="Bạn muốn đi đâu?"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="header-search-input"
            />
            <button type="submit" className="header-search-btn">
              <Search size={18} />
            </button>
          </form>

          {/* Header Actions */}
          <div className="header-actions">
            {/* Currency Selector capsule */}
            <div className="currency-selector" onClick={toggleCurrency}>
              <span className="currency-flag">{currency === 'VND' ? '🇻🇳' : '🇺🇸'}</span>
              <span className="currency-text">{currency === 'VND' ? 'VND / $' : 'USD / ₫'}</span>
              <ChevronDown size={14} className="currency-chevron" />
            </div>

            {/* Shopping Cart button */}
            <button className="cart-btn-header" onClick={() => setIsCartOpen(true)}>
              <div className="cart-icon-wrapper">
                <ShoppingCart size={20} />
                {cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}
              </div>
            </button>

            {/* Login button */}
            <button className="login-btn-header" onClick={() => { setIsLoggedIn(true); window.location.hash = '#/dashboard'; }}>
              <LogIn size={16} />
              <span>{isLoggedIn ? (currentUser?.name || 'Tài khoản') : 'Đăng nhập'}</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              className="icon-btn mobile-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Row 2: Desktop Navigation Links */}
        <nav className="desktop-nav-row">
          <button onClick={() => handleNav('destinations-and-packages')} className="nav-link-item">Điểm đến</button>
          <button onClick={() => handleNav('destinations-and-packages')} className="nav-link-item">Gói khu vực</button>
          <button onClick={() => handleNav('destinations-and-packages')} className="nav-link-item">Gói toàn cầu</button>
          <button onClick={() => handleNav('app-reviews-articles')} className="nav-link-item">eSIM cho doanh nghiệp</button>
          <button onClick={() => handleNav('hardware-devices')} className="nav-link-item">Thiết bị 4G / 5G</button>
          <button onClick={() => handleNav('how-and-why')} className="nav-link-item">Hướng dẫn</button>
          <button onClick={() => handleNav('app-reviews-articles')} className="nav-link-item">Ứng dụng</button>
        </nav>
      </div>

      {/* Mobile Drawer Navigation */}
      <div className={`mobile-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          {/* Mobile Logo */}
          <a href="/" className="logo-link" onClick={handleLogoClick}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="100" height="34">
              <text x="5" y="28" fontFamily="'Outfit', sans-serif" fontWeight="900" fontSize="24" fill="#FF4F00">HIC</text>
              <circle cx="63" cy="20" r="9.5" fill="none" stroke="#FF4F00" strokeWidth="2.5" />
              <path d="M57,20 L69,20" stroke="#FF4F00" strokeWidth="1" />
              <path d="M63,11.5 L63,28.5" stroke="#FF4F00" strokeWidth="1" />
              <path d="M78,15 A8,8 0 0,1 84,21" fill="none" stroke="#FF4F00" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M78,10 A14,14 0 0,1 89,21" fill="none" stroke="#FF4F00" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </a>
          <button className="icon-btn" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <nav className="mobile-nav">
          <button onClick={() => handleNav('destinations-and-packages')} className="mobile-nav-link">Điểm đến</button>
          <button onClick={() => handleNav('destinations-and-packages')} className="mobile-nav-link">Gói khu vực</button>
          <button onClick={() => handleNav('destinations-and-packages')} className="mobile-nav-link">Gói toàn cầu</button>
          <button onClick={() => handleNav('app-reviews-articles')} className="mobile-nav-link">eSIM cho doanh nghiệp</button>
          <button onClick={() => handleNav('hardware-devices')} className="mobile-nav-link">Thiết bị 4G / 5G</button>
          <button onClick={() => handleNav('how-and-why')} className="mobile-nav-link">Hướng dẫn</button>
          <button onClick={() => handleNav('app-reviews-articles')} className="mobile-nav-link">Ứng dụng</button>
          <div className="mobile-drawer-footer">
            <button className="mobile-action-btn primary" onClick={() => { window.location.hash = '#/admin'; setIsMobileMenuOpen(false); }}>
              Đăng nhập
            </button>
          </div>
        </nav>
      </div>
      {isMobileMenuOpen && (
        <div className="drawer-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </header>
  );
};
