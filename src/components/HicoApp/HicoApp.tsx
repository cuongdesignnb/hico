import React from 'react';
import './HicoApp.css';

export const HicoApp: React.FC = () => {
  return (
    <div className="hico-app-block">
      <h2 className="section-title">Ứng dụng HICO</h2>
      <p className="app-block-subtitle">Quản lý eSIM mọi lúc mọi nơi</p>

      <div className="app-split-container">
        {/* Left Side: Checklist and Store Badges */}
        <div className="app-left-content">
          <ul className="app-block-list">
            <li>
              <div className="app-check-icon">✓</div>
              <span>Mua & cài đặt eSIM dễ dàng</span>
            </li>
            <li>
              <div className="app-check-icon">✓</div>
              <span>Theo dõi dung lượng sử dụng</span>
            </li>
            <li>
              <div className="app-check-icon">✓</div>
              <span>Nạp thêm gói cước</span>
            </li>
            <li>
              <div className="app-check-icon">✓</div>
              <span>Hỗ trợ 24/7 trong ứng dụng</span>
            </li>
          </ul>

          {/* Store buttons */}
          <div className="app-stores-row">
            <a href="#" className="store-badge-btn" onClick={(e) => { e.preventDefault(); alert('iOS App coming soon!'); }}>
              <span className="st-sub">App Store</span>
            </a>
            <a href="#" className="store-badge-btn" onClick={(e) => { e.preventDefault(); alert('Android App coming soon!'); }}>
              <span className="st-sub">Google Play</span>
            </a>
          </div>
        </div>

        {/* Right Side: Phone mockup */}
        <div className="app-right-content">
          <div className="app-phone-mockup">
            <div className="mini-phone-bezel">
              <div className="mini-phone-screen">
                {/* Dynamic Island */}
                <div className="mini-dynamic-island"></div>
                
                <div className="mini-phone-header">
                  <span>Xin chào, HICO!</span>
                </div>

                {/* Dashboard content */}
                <div className="mini-dashboard-card">
                  <div className="mini-card-head">
                    <span>DUNG LƯỢNG CÒN LẠI</span>
                  </div>
                  <span className="mini-data-val">6.2 GB</span>
                  <div className="mini-data-progress-bar">
                    <div className="mini-progress-fill" style={{ width: '62%' }}></div>
                  </div>
                  <div className="mini-card-foot">
                    <span>Nhật Bản</span>
                    <span>còn 15 ngày</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
