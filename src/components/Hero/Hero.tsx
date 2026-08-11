import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Compass, Globe, Headphones, MapPin, Shield, Zap } from 'lucide-react';
import { useApp } from '../../context/useApp';
import './Hero.css';

const slides = [
  { id: 'global', title: 'Kết nối toàn cầu', subtitle: 'Chọn đúng sản phẩm canonical cho hành trình của bạn.', image: '/images/art_travel_tips.png', search: '' },
  { id: 'simple', title: 'Kết nối thật đơn giản', subtitle: 'Danh mục public cập nhật theo product và variant đang được publish.', image: '/images/art_esim_intro.png', search: '' },
  { id: 'ready', title: 'Sẵn sàng cho chuyến đi', subtitle: 'Xem giá, tồn kho và fulfillment trực tiếp từ dữ liệu canonical.', image: '/images/art_sim_compare.png', search: '' },
];

export const Hero: React.FC = () => {
  const { setSearchQuery } = useApp();
  const [localSearch, setLocalSearch] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSlide = slides[currentSlide];

  const stopRotation = useCallback(() => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } }, []);
  const changeSlide = useCallback((next: number) => { setIsFading(true); fadeTimeoutRef.current = setTimeout(() => { setCurrentSlide(next); setIsFading(false); }, 220); }, []);
  const startRotation = useCallback(() => { stopRotation(); intervalRef.current = setInterval(() => changeSlide((currentSlide + 1) % slides.length), 6500); }, [changeSlide, currentSlide, stopRotation]);
  useEffect(() => { startRotation(); return () => { stopRotation(); if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current); }; }, [startRotation, stopRotation]);

  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setSearchQuery(localSearch.trim()); document.getElementById('destinations-and-packages')?.scrollIntoView({ behavior: 'smooth' }); };
  const quickSearch = () => { setSearchQuery(activeSlide.search); document.getElementById('destinations-and-packages')?.scrollIntoView({ behavior: 'smooth' }); };

  return <section className="hero-section"><div className="container hero-container"><div className={`hero-content ${isFading ? 'slide-fade-out' : 'slide-fade-in'}`}><span className="hero-slide-badge">Dữ liệu canonical từ HICO</span><h1 className="hero-title">{activeSlide.title}<br /><span className="text-orange">HICO eSIM</span></h1><p className="hero-subtitle">{activeSlide.subtitle}</p><form onSubmit={submitSearch} className="hero-search-bar"><div className="search-input-wrapper"><MapPin className="search-icon" size={20} /><input type="text" placeholder="Bạn muốn đến đâu?" value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} className="hero-search-input" /></div><button type="submit" className="hero-search-btn">Tìm kiếm</button></form><div className="hero-slide-indicators">{slides.map((slide, index) => <button key={slide.id} type="button" className={`slide-indicator ${currentSlide === index ? 'active' : ''}`} onClick={() => { stopRotation(); changeSlide(index); }} aria-label={`Chuyển đến nội dung ${index + 1}`} />)}</div><div className="hero-quick-actions"><button type="button" onClick={() => { setSearchQuery(''); document.getElementById('destinations-and-packages')?.scrollIntoView({ behavior: 'smooth' }); }} className="quick-btn primary">Xem danh mục</button><button type="button" onClick={quickSearch} className="quick-btn secondary"><Compass size={16} /><span>Khám phá sản phẩm</span></button></div><div className="hero-trust-badges"><div className="trust-badge"><Globe size={20} /><span>Catalog canonical</span></div><div className="trust-badge"><Shield size={20} /><span>Giá tin cậy</span></div><div className="trust-badge"><Zap size={20} /><span>Fulfillment rõ ràng</span></div><div className="trust-badge"><Headphones size={20} /><span>Hỗ trợ 24/7</span></div></div></div><div className={`hero-mockup-wrapper ${isFading ? 'slide-fade-out' : 'slide-fade-in'}`}><div className="hero-slide-image-wrapper"><div className="hero-slide-image-card"><img src={activeSlide.image} alt={activeSlide.title} className="hero-slide-image" /><div className="hero-slide-floating-tag glass-panel"><strong>{activeSlide.title}</strong><span>Xem thông tin từ catalog public</span></div></div></div></div></div></section>;
};
