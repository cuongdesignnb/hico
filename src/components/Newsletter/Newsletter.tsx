import React, { useState } from 'react';
import { Mail, CheckCircle, ArrowRight } from 'lucide-react';
import './Newsletter.css';

export const Newsletter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    // Simulate API registration call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubscribed(true);
      setEmail('');
    }, 1500);
  };

  return (
    <section className="newsletter-section">
      <div className="container">
        <div className="newsletter-panel glass-panel">
          {isSubscribed ? (
            <div className="subscribed-success-state fade-in">
              <CheckCircle size={48} className="success-check-icon" />
              <h3>Đăng ký thành công!</h3>
              <p>Cảm ơn bạn. HICO sẽ gửi những ưu đãi độc quyền 15% sớm nhất vào hòm thư của bạn.</p>
              <button className="sub-reset-btn" onClick={() => setIsSubscribed(false)}>
                Đăng ký email khác
              </button>
            </div>
          ) : (
            <div className="newsletter-grid">
              {/* Text Info */}
              <div className="newsletter-text-box">
                <div className="newsletter-title-row">
                  <Mail size={28} className="mail-icon-pulse" />
                  <h2>Nhận ưu đãi & tin tức mới nhất</h2>
                </div>
                <p>
                  Đăng ký email ngay hôm nay để nhận voucher giảm giá <strong>15%</strong> cho gói cước đầu tiên và nhận cẩm nang du lịch hữu ích.
                </p>
              </div>

              {/* Form Input */}
              <form onSubmit={handleSubmit} className="newsletter-form">
                <div className="input-group-wrapper">
                  <input
                    type="email"
                    placeholder="Nhập địa chỉ email của bạn..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="newsletter-input"
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    className="newsletter-submit-btn"
                    disabled={isSubmitting}
                  >
                    <span>{isSubmitting ? 'Đang gửi...' : 'Đăng ký'}</span>
                    {!isSubmitting && <ArrowRight size={18} />}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
