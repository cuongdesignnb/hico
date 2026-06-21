import React from 'react';
import { Lock } from 'lucide-react';
import './Footer.css';

// Custom SVG Icons
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" />
  </svg>
);

// SVG for TikTok icon (since Lucide does not have TikTok by default)
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ display: 'block' }}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.74-3.99-1.72-.08-.07-.17-.17-.25-.25v6.07c0 1.63-.4 3.26-1.23 4.62-1.34 2.22-3.83 3.65-6.42 3.77-3.23.16-6.56-1.57-7.87-4.57-1.39-3.2-.24-7.39 2.79-9.28 1.42-.89 3.12-1.25 4.77-1.07v4.06c-1.12-.22-2.34-.02-3.26.68-.97.74-1.37 2.06-1.04 3.24.36 1.25 1.56 2.18 2.87 2.18 1.64-.02 3-.16 3-1.82V0l.02.02z" />
  </svg>
);

export const Footer: React.FC = () => {
  return (
    <footer className="footer-section">
      <div className="container">
        {/* Main Footer Content */}
        <div className="footer-grid">
          {/* Logo & Description column */}
          <div className="footer-info-col">
            <img src="/logo.svg" alt="HICO eSIM Logo" className="footer-logo" />
            <p className="footer-desc">
              HICO eSIM - Kết nối toàn cầu<br />Nhanh chóng, tin cậy và tiết kiệm.
            </p>
            <div className="social-links">
              <a href="#" className="social-icon-btn" aria-label="Facebook">
                <FacebookIcon />
              </a>
              <a href="#" className="social-icon-btn" aria-label="Instagram">
                <InstagramIcon />
              </a>
              <a href="#" className="social-icon-btn" aria-label="YouTube">
                <YoutubeIcon />
              </a>
              <a href="#" className="social-icon-btn" aria-label="TikTok">
                <TikTokIcon />
              </a>
            </div>
          </div>

          {/* Links Column 1 */}
          <div className="footer-links-col">
            <h4>Khám phá</h4>
            <ul>
              <li><a href="#destinations">Điểm đến</a></li>
              <li><a href="#featured-packages">Gói khu vực</a></li>
              <li><a href="#featured-packages">Gói toàn cầu</a></li>
              <li><a href="#hico-app">eSIM cho doanh nghiệp</a></li>
              <li><a href="#">Khuyến mãi</a></li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="footer-links-col">
            <h4>Về HICO</h4>
            <ul>
              <li><a href="#">Giới thiệu</a></li>
              <li><a href="#">Tuyển dụng</a></li>
              <li><a href="#">Đối tác</a></li>
              <li><a href="#articles">Tin tức</a></li>
              <li><a href="#">Liên hệ</a></li>
            </ul>
          </div>

          {/* Links Column 3 */}
          <div className="footer-links-col">
            <h4>Hỗ trợ</h4>
            <ul>
              <li><a href="#">Trung tâm trợ giúp</a></li>
              <li><a href="#how-it-works">Hướng dẫn cài đặt</a></li>
              <li><a href="#">Chính sách hoàn tiền</a></li>
              <li><a href="#">Câu hỏi thường gặp</a></li>
              <li><a href="#">Liên hệ hỗ trợ</a></li>
            </ul>
          </div>

          {/* Links Column 4 */}
          <div className="footer-links-col">
            <h4>Chính sách</h4>
            <ul>
              <li><a href="#">Điều khoản sử dụng</a></li>
              <li><a href="#">Chính sách bảo mật</a></li>
              <li><a href="#">Chính sách cookie</a></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom (Payments and Copyright) */}
        <div className="footer-bottom">
          <div className="copyright-area">
            <span className="copyright-text">© 2025 HICO. Tất cả bản quyền được bảo lưu.</span>
            <div className="ssl-security">
              <Lock size={14} className="ssl-icon" />
              <span>Được bảo mật bởi SSL 256-bit</span>
            </div>
          </div>

          {/* Payment Badges */}
          <div className="payment-methods">
            <span className="payment-label">Phương thức thanh toán:</span>
            <div className="payment-icons-wrapper">
              <span className="payment-badge-text visa">VISA</span>
              <span className="payment-badge-text mastercard">MasterCard</span>
              <span className="payment-badge-text jcb">JCB</span>
              <span className="payment-badge-text amex">AMEX</span>
              <span className="payment-badge-text paypal">PayPal</span>
              <span className="payment-badge-text gpay">G Pay</span>
              <span className="payment-badge-text applepay">Apple Pay</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
