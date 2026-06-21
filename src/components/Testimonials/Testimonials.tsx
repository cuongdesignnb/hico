import React from 'react';
import { Star } from 'lucide-react';
import './Testimonials.css';

interface Testimonial {
  name: string;
  location: string;
  avatar: string;
  rating: number;
  text: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Minh Anh',
    location: 'Hà Nội, Việt Nam',
    avatar: '/images/avatar_minh_anh.png',
    rating: 5,
    text: '"Kết nối nhanh, ổn định ở Nhật Bản. Cài đặt dễ dàng và giá cả rất hợp lý!"',
  },
  {
    name: 'Quốc Bảo',
    location: 'TP. Hồ Chí Minh',
    avatar: '/images/avatar_quoc_bao.png',
    rating: 5,
    text: '"Dùng ở châu Âu 2 tuần không gặp vấn đề gì. Rất đáng tiền!"',
  },
  {
    name: 'Thu Hương',
    location: 'Đà Nẵng',
    avatar: '/images/avatar_thu_huong.png',
    rating: 5,
    text: '"HICO eSIM giúp chuyến đi của mình dễ dàng và thoải mái hơn rất nhiều!"',
  },
];

export const Testimonials: React.FC = () => {
  return (
    <div className="testimonials-block">
      <h2 className="section-title">Được tin tưởng bởi hàng nghìn du khách</h2>
      <p className="testimonials-block-subtitle">Đánh giá thực tế từ khách hàng</p>

      {/* Horizontal cards list */}
      <div className="testimonials-horizontal-list">
        {TESTIMONIALS.map((t, idx) => (
          <div key={idx} className="mini-testimonial-card">
            {/* Header info */}
            <div className="mini-t-header">
              <img src={t.avatar} alt={t.name} className="mini-t-avatar" />
              <div className="mini-t-meta">
                <h3>{t.name}</h3>
                <span>{t.location}</span>
              </div>
              <div className="mini-t-stars">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} size={10} fill="#F59E0B" color="#F59E0B" />
                ))}
              </div>
            </div>
            {/* Review text */}
            <p className="mini-t-text">{t.text}</p>
          </div>
        ))}
      </div>

      {/* Pagination Dots */}
      <div className="testimonials-dots-row">
        <span className="dot active"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    </div>
  );
};
