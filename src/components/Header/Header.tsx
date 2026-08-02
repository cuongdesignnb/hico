import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Menu, X, LogIn, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/useApp';
import { useAuth } from '../../auth/useAuth';
import './Header.css';

const Logo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="110" height="36" className="logo-img-svg" aria-label="HICO">
    <text x="5" y="28" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="24" fill="#FF4F00">HIC</text>
    <circle cx="63" cy="20" r="9.5" fill="none" stroke="#FF4F00" strokeWidth="2.5" />
    <path d="M57,20 L69,20 M63,11.5 L63,28.5 M58,16 Q63,18 68,16 M58,24 Q63,22 68,24" fill="none" stroke="#FF4F00" strokeWidth="1" />
    <path d="M78,15 A8,8 0 0,1 84,21 M78,10 A14,14 0 0,1 89,21 M78,5 A20,20 0 0,1 94,21" fill="none" stroke="#FF4F00" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, setIsCartOpen, setSearchQuery } = useApp();
  const { status, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [currency, setCurrency] = useState<'VND' | 'USD'>('VND');
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToSection = (sectionId: string) => {
    const scroll = () => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(scroll, 0);
    } else {
      scroll();
    }
    setIsMobileMenuOpen(false);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchQuery(localSearch);
    navigate('/san-pham');
  };

  const openCart = () => {
    setIsCartOpen(true);
    navigate('/gio-hang');
  };

  const openAccount = () => {
    navigate(status === 'authenticated' ? '/quan-tri' : '/dang-nhap');
  };

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container header-container-main">
        <div className="header-top-row">
          <Link to="/" className="logo-link" aria-label="HICO home"><Logo /></Link>
          <form onSubmit={handleSearchSubmit} className="header-search-form">
            <input type="search" placeholder="Ban muon di dau?" value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} className="header-search-input" />
            <button type="submit" className="header-search-btn" aria-label="Search"><Search size={18} /></button>
          </form>
          <div className="header-actions">
            <button type="button" className="currency-selector" onClick={() => setCurrency((value) => value === 'VND' ? 'USD' : 'VND')} aria-label="Change currency">
              <span className="currency-text">{currency === 'VND' ? 'VND / USD' : 'USD / VND'}</span><ChevronDown size={14} className="currency-chevron" />
            </button>
            <button className="cart-btn-header" onClick={openCart} aria-label="Cart"><span className="cart-icon-wrapper"><ShoppingCart size={20} />{cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}</span></button>
            <button className="login-btn-header" onClick={openAccount}><LogIn size={16} /><span>{status === 'authenticated' ? user?.displayName || 'Admin' : 'Dang nhap'}</span></button>
            <button className="icon-btn mobile-menu-toggle" onClick={() => setIsMobileMenuOpen((open) => !open)} aria-label="Open navigation">{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
          </div>
        </div>
        <nav className="desktop-nav-row" aria-label="Main navigation">
          <Link to="/diem-den" className="nav-link-item">Diem den</Link>
          <Link to="/san-pham" className="nav-link-item">San pham</Link>
          <Link to="/nap-them" className="nav-link-item">Nap them</Link>
          <Link to="/thiet-bi" className="nav-link-item">Thiet bi 4G / 5G</Link>
          <Link to="/bai-viet" className="nav-link-item">Huong dan</Link>
          <button onClick={() => goToSection('reviews-and-articles')} className="nav-link-item">Tin tuc</button>
        </nav>
      </div>
      <div className={`mobile-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header"><Link to="/" className="logo-link" onClick={() => setIsMobileMenuOpen(false)}><Logo /></Link><button className="icon-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation"><X size={24} /></button></div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <Link to="/diem-den" onClick={() => setIsMobileMenuOpen(false)} className="mobile-nav-link">Diem den</Link>
          <Link to="/san-pham" onClick={() => setIsMobileMenuOpen(false)} className="mobile-nav-link">San pham</Link>
          <Link to="/nap-them" onClick={() => setIsMobileMenuOpen(false)} className="mobile-nav-link">Nap them</Link>
          <Link to="/thiet-bi" onClick={() => setIsMobileMenuOpen(false)} className="mobile-nav-link">Thiet bi</Link>
          <Link to="/bai-viet" onClick={() => setIsMobileMenuOpen(false)} className="mobile-nav-link">Huong dan</Link>
          <div className="mobile-drawer-footer"><button className="mobile-action-btn primary" onClick={openAccount}>Dang nhap</button></div>
        </nav>
      </div>
      {isMobileMenuOpen && <div className="drawer-overlay" onClick={() => setIsMobileMenuOpen(false)} />}
    </header>
  );
};
