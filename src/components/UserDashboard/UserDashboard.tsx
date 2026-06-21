import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, Cpu, ClipboardList, Wifi, Wallet, Gift, 
  Headphones, User, Search, ChevronDown, Bell, ShoppingCart, 
  Copy, Check, Plus, Calendar, Star, MessageSquare, 
  Mail, Phone, CreditCard, Info, 
  Smartphone, Share2, HelpCircle, CheckCircle2
} from 'lucide-react';
import './UserDashboard.css';

export const UserDashboard: React.FC = () => {
  const { cart, addToCart, setIsCartOpen, triggerNotification, setIsLoggedIn, currentUser, setCurrentUser } = useApp();
  const [activeMenu, setActiveMenu] = useState('Tổng quan');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [esimData, setEsimData] = useState({
    iccid: '898520400001234567',
    rcode: 'RC_JAPAN_MOCK',
    status: 'Đang hoạt động',
    productName: 'Nhật Bản eSIM 10GB - 15 ngày',
    network: 'NTT Docomo',
    usedData: 3.58,
    totalData: 10,
    expiry: '24/05/2024',
    device: 'iPhone 14 Pro',
    qrcode: 'https://tfmshippingsys.fastmove.com.tw/tApi/images/redeem_sample.jpg',
    qrcodeContent: 'LPA:1$rsp.worldmove.com$RC_JAPAN_MOCK8985204000',
    pin1: '1111',
    puk1: '33334444',
    apnExplain: 'Carrier NTT Docomo APN: spmode.ne.jp'
  });
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [loadingEsimActivation, setLoadingEsimActivation] = useState(false);
  const [activeIccid, setActiveIccid] = useState('898520400001234567');

  const fetchUserOrders = async () => {
    try {
      const res = await fetch('/api/user/orders');
      if (res.ok) {
        const data = await res.json();
        setUserOrders(data);
        setIsBackendConnected(true);
        
        // Find if there is any PENDING_CALLBACK order
        const pending = data.find((o: any) => o.status === 'PENDING_CALLBACK');
        if (pending) {
          setLoadingEsimActivation(true);
        } else {
          setLoadingEsimActivation(false);
          // Auto switch active ICCID to the newly provisioned SIM if any
          const latestProv = data.find((o: any) => o.status === 'PROVISIONED' && o.items && o.items.length > 0);
          if (latestProv && latestProv.items[0].iccid !== activeIccid) {
            setActiveIccid(latestProv.items[0].iccid);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch user orders:", e);
    }
  };

  const fetchEsimData = async () => {
    if (!activeIccid) return;
    try {
      const response = await fetch(`/api/user/esim/${activeIccid}`);
      if (response.ok) {
        const data = await response.json();
        setEsimData(prev => ({
          ...prev,
          ...data,
          status: data.status,
          productName: data.productName
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch eSIM data:", e);
    }
  };

  useEffect(() => {
    setIsLoggedIn(true);
    if (!currentUser) {
      setCurrentUser({
        name: 'Sơn Nguyễn',
        email: 'son.nguyen@gmail.com',
        phone: '0912345678'
      });
    }
  }, []);

  useEffect(() => {
    fetchUserOrders();
  }, []);

  // Poll orders when waiting for callback activation
  useEffect(() => {
    const timer = setInterval(fetchUserOrders, loadingEsimActivation ? 3000 : 10000);
    return () => clearInterval(timer);
  }, [loadingEsimActivation]);

  // Refetch eSIM data when activeIccid or activation state changes
  useEffect(() => {
    fetchEsimData();
  }, [activeIccid, loadingEsimActivation]);

  // Cart total items count
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    triggerNotification(`Đã sao chép ${label}: ${text} vào bộ nhớ tạm!`, 'success');
  };

  const handleAddHardwareToCart = (id: string, name: string, priceUsd: number, image: string) => {
    addToCart({
      id,
      name,
      type: 'device',
      price: priceUsd,
      image
    });
    triggerNotification(`Đã thêm thiết bị ${name} vào giỏ hàng!`);
  };

  const handleAddEsimToCart = (id: string, name: string, priceUsd: number, dataLimit: string, duration: string) => {
    addToCart({
      id,
      name,
      type: 'esim',
      price: priceUsd,
      dataLimit,
      duration
    });
    triggerNotification(`Đã thêm gói ${name} vào giỏ hàng!`);
  };

  const handleTopup = async () => {
    if (isBackendConnected) {
      try {
        const response = await fetch('/api/user/topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ iccid: esimData.iccid, days: 15 })
        });
        if (response.ok) {
          triggerNotification(`Giao dịch thành công! Nạp thêm 5GB dữ liệu vào eSIM ${esimData.iccid}!`, 'success');
          fetchEsimData();
          return;
        }
      } catch (e) {
        // fallback to cart below
      }
    }
    
    handleAddEsimToCart('japan-esim-pkg-10gb', 'Nhật Bản eSIM - Gói 10 GB (15 ngày)', 490000, '10 GB', '15 ngày');
    setIsCartOpen(true);
  };

  return (
    <div className="user-dashboard-shell">
      {/* 1. Sidebar Navigation (Left) */}
      <aside className="dashboard-sidebar">
        {/* Logo */}
        <div className="sidebar-logo-box">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="110" height="36">
            <text x="5" y="28" fontFamily="'Outfit', sans-serif" fontWeight="900" fontSize="24" fill="#FF4F00">HIC</text>
            <circle cx="63" cy="20" r="9.5" fill="none" stroke="#FF4F00" strokeWidth="2.5" />
            <path d="M57,20 L69,20" stroke="#FF4F00" strokeWidth="1" />
            <path d="M63,11.5 L63,28.5" stroke="#FF4F00" strokeWidth="1" />
            <path d="M58,16 Q63,18 68,16" fill="none" stroke="#FF4F00" strokeWidth="1" />
            <path d="M58,24 Q63,22 68,24" fill="none" stroke="#FF4F00" strokeWidth="1" />
            <path d="M78,15 A8,8 0 0,1 84,21" fill="none" stroke="#FF4F00" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M78,10 A14,14 0 0,1 89,21" fill="none" stroke="#FF4F00" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M78,5 A20,20 0 0,1 94,21" fill="none" stroke="#FF4F00" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Menu links */}
        <nav className="sidebar-nav-menu">
          {[
            { name: 'Tổng quan', icon: <LayoutDashboard size={18} /> },
            { name: 'eSIM của tôi', icon: <Cpu size={18} /> },
            { name: 'Đơn hàng', icon: <ClipboardList size={18} /> },
            { name: 'Thiết bị 4G/5G', icon: <Wifi size={18} /> },
            { name: 'Ví & thanh toán', icon: <Wallet size={18} /> },
            { name: 'Ưu đãi', icon: <Gift size={18} /> },
            { name: 'Hỗ trợ', icon: <Headphones size={18} /> },
            { name: 'Tài khoản', icon: <User size={18} /> },
          ].map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setActiveMenu(item.name);
                triggerNotification(`Bạn đã chọn tab: ${item.name}`, 'info');
              }}
              className={`sidebar-nav-item ${activeMenu === item.name ? 'active' : ''}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        {/* Bottom Widgets */}
        <div className="sidebar-widgets-box">
          {/* Referral Card */}
          <div className="sidebar-promo-card">
            <div className="promo-widget-header">
              <div className="widget-icon-wrapper">
                <Gift size={16} />
              </div>
              <div className="widget-title-text">
                Giới thiệu bạn bè
                <span>Nhận ngay 50.000đ</span>
              </div>
            </div>
            <p className="widget-desc-text">
              Nhận ngay <strong>50.000đ</strong> cho bạn và người được giới thiệu.
            </p>
            <button 
              className="widget-action-btn"
              onClick={() => handleCopyText('HICOSON50', 'mã giới thiệu')}
            >
              <Share2 size={12} /> Giới thiệu ngay
            </button>
          </div>

          {/* Support Widget */}
          <div className="sidebar-support-card">
            <div className="support-widget-header">
              <div className="widget-icon-wrapper purple">
                <Headphones size={16} />
              </div>
              <div className="widget-title-text">
                Cần hỗ trợ nhanh?
                <span>Chat trực tiếp 24/7</span>
              </div>
            </div>
            <p className="widget-desc-text">
              Đội ngũ kỹ thuật của HICO luôn sẵn sàng phản hồi ngay lập tức.
            </p>
            <button 
              className="widget-action-btn"
              onClick={() => triggerNotification('Đang kết nối với nhân viên hỗ trợ...', 'info')}
            >
              <MessageSquare size={12} /> Chat ngay
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="dashboard-main-area">
        {/* Topbar */}
        <header className="dashboard-topbar">
          {/* Left search */}
          <form onSubmit={(e) => { e.preventDefault(); triggerNotification('Tìm kiếm eSIM thành công!'); }} className="topbar-search-form">
            <input 
              type="text" 
              placeholder="Bạn muốn đi đâu?" 
              className="topbar-search-input"
            />
            <button type="submit" className="topbar-search-btn">
              <Search size={18} />
            </button>
          </form>

          {/* Right Topbar actions */}
          <div className="topbar-actions">
            {/* Currency flag switcher */}
            <div 
              className="topbar-currency-switcher" 
              style={{ cursor: 'default' }}
            >
              <span>🇻🇳</span>
              <span>VNĐ</span>
            </div>

            {/* Gift button */}
            <div 
              className="topbar-promo-tag"
              onClick={() => triggerNotification('Mở danh sách ưu đãi quà tặng!', 'success')}
            >
              <Gift size={16} />
              <span>Ưu đãi</span>
            </div>

            {/* Notification bell */}
            <button 
              className="topbar-btn"
              onClick={() => triggerNotification('Bạn có 3 thông báo mới chưa đọc', 'info')}
            >
              <Bell size={20} />
              <span className="topbar-btn-badge">3</span>
            </button>

            {/* Cart Icon */}
            <button 
              className="topbar-btn"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingCart size={20} />
              <span className="topbar-btn-badge">{Math.max(2, cartItemCount)}</span>
            </button>

            {/* Profile Avatar & Name */}
            <div 
              className="topbar-profile-box"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <img src="/images/avatar_admin.png" alt="Sơn" className="topbar-avatar" />
              <span className="topbar-profile-name">Sơn</span>
              <ChevronDown size={14} className="topbar-profile-chevron" />

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="profile-dropdown-menu">
                  <button className="dropdown-item" onClick={() => window.location.hash = ''}>
                    Trang chủ HICO
                  </button>
                  <button className="dropdown-item" onClick={() => window.location.hash = '#/admin'}>
                    Trang quản trị
                  </button>
                  <button className="dropdown-item" onClick={() => triggerNotification('Tính năng Hồ sơ cá nhân đang phát triển!', 'info')}>
                    Tài khoản cá nhân
                  </button>
                  <button 
                    className="dropdown-item" 
                    onClick={() => {
                      setIsLoggedIn(false);
                      setCurrentUser(null);
                      window.location.hash = '';
                      triggerNotification('Đăng xuất thành công!', 'info');
                    }}
                    style={{ borderTop: '1px solid var(--border-light)', color: 'red' }}
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content Container */}
        <div className="dashboard-content">
          {/* Welcoming Header */}
          <div className="dashboard-header-block">
            <h1 className="dashboard-greeting">Xin chào, Sơn 👋</h1>
            <p className="dashboard-subtitle">
              Quản lý eSIM, đơn hàng và tài khoản của bạn một cách dễ dàng.
              <span style={{ marginLeft: '12px', fontSize: '11px', color: isBackendConnected ? 'var(--success-green)' : 'var(--text-light)', fontWeight: 600 }}>
                ● {isBackendConnected ? 'Kết nối Backend (Worldmove LIVE)' : 'Chế độ Demo (Offline)'}
              </span>
            </p>
          </div>

          {/* Quick Stats Row (4 Cards) */}
          <div className="dashboard-stats-grid">
            {/* Stat 1 */}
            <div className="stat-card-box">
              <div className="stat-card-header">
                <span className="stat-card-label">eSIM đang hoạt động</span>
                <div className="stat-icon-wrapper orange">
                  <Cpu size={16} />
                </div>
              </div>
              <span className="stat-card-value">1</span>
              <a 
                href="#/dashboard" 
                onClick={(e) => { e.preventDefault(); triggerNotification('Đang cuộn tới chi tiết eSIM đang hoạt động'); }} 
                className="stat-card-link"
              >
                Xem chi tiết →
              </a>
            </div>

            {/* Stat 2 */}
            <div className="stat-card-box">
              <div className="stat-card-header">
                <span className="stat-card-label">Dung lượng còn lại</span>
                <div className="stat-icon-wrapper green">
                  <Wifi size={16} />
                </div>
              </div>
              <span className="stat-card-value">{(esimData.totalData - esimData.usedData).toFixed(2)} GB</span>
              <span className="stat-card-sub">Trong tổng {esimData.totalData} GB</span>
              <div className="stat-progress-container">
                <div className="stat-progress-bar green" style={{ width: `${((esimData.totalData - esimData.usedData) / esimData.totalData * 100).toFixed(1)}%` }}></div>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="stat-card-box">
              <div className="stat-card-header">
                <span className="stat-card-label">Ngày còn hiệu lực</span>
                <div className="stat-icon-wrapper purple">
                  <Calendar size={16} />
                </div>
              </div>
              <span className="stat-card-value">{esimData.status === 'Đang hoạt động' ? '9 ngày' : 'Chưa kích hoạt'}</span>
              <span className="stat-card-sub">Hết hạn: {esimData.expiry}</span>
            </div>

            {/* Stat 4 */}
            <div className="stat-card-box">
              <div className="stat-card-header">
                <span className="stat-card-label">Điểm thưởng HICO</span>
                <div className="stat-icon-wrapper yellow">
                  <Star size={16} />
                </div>
              </div>
              <span className="stat-card-value">1.250 điểm</span>
              <a 
                href="#/dashboard" 
                onClick={(e) => { e.preventDefault(); triggerNotification('Chuyển hướng đến cửa hàng đổi quà HICO!'); }} 
                className="stat-card-link"
              >
                Đổi ưu đãi ngay →
              </a>
            </div>
          </div>

          {/* Main Content Layout Grid */}
          <div className="dashboard-main-split-grid">
            
            {/* Left Column (eSIM, QR Card, Orders Table, Promo) */}
            <div className="grid-left-col">
              
              {/* eSIM and QR Card Container */}
              <div className="dashboard-card-wrapper">
                <div className="esim-details-qr-row">
                  {/* Left Column: eSIM Info Card */}
                  <div className="esim-info-card-box">
                    <div className="esim-card-img-wrapper">
                      <img src="/images/dest_japan.png" alt="Nhật Bản" className="esim-card-img" />
                      <div className="esim-card-overlay">
                        <span className="esim-overlay-country">NHẬT BẢN</span>
                        <span className="esim-overlay-tag">eSIM</span>
                        <span className="esim-card-footer-duration">{esimData.totalData}GB - 15 ngày</span>
                      </div>
                    </div>

                    <div className="esim-card-details-box">
                      <div className="esim-card-title-row">
                        <h3 className="esim-card-title-text">{esimData.productName}</h3>
                        <span className={`status-badge ${esimData.status === 'Đang hoạt động' ? 'active' : 'pending'}`}>{esimData.status}</span>
                      </div>

                      <div className="esim-details-list">
                        <div className="esim-details-row">
                          <span className="esim-row-lbl">Nhà mạng</span>
                          <span className="esim-row-val">
                            {esimData.network} 
                            <span className="badge-4g-5g">4G/5G</span>
                          </span>
                        </div>
                        <div className="esim-details-row">
                          <span className="esim-row-lbl">Dung lượng</span>
                          <span className="esim-row-val">{esimData.usedData} GB / {esimData.totalData} GB</span>
                        </div>
                        {/* Custom orange progress bar */}
                        <div className="stat-progress-container" style={{ margin: '-2px 0 6px 0' }}>
                          <div className="stat-progress-bar orange" style={{ width: `${(esimData.usedData / esimData.totalData * 100).toFixed(1)}%` }}></div>
                        </div>
                        <div className="esim-details-row">
                          <span className="esim-row-lbl">Ngày còn lại</span>
                          <span className="esim-row-val">{esimData.status === 'Đang hoạt động' ? '9 ngày' : 'Chưa kích hoạt'}</span>
                        </div>
                        {/* Custom orange progress bar for days */}
                        <div className="stat-progress-container" style={{ margin: '-2px 0 6px 0' }}>
                          <div className="stat-progress-bar orange" style={{ width: esimData.status === 'Đang hoạt động' ? '60%' : '0%' }}></div>
                        </div>
                        <div className="esim-details-row">
                          <span className="esim-row-lbl">Thiết bị</span>
                          <span className="esim-row-val">{esimData.device}</span>
                        </div>
                        <div className="esim-details-row">
                          <span className="esim-row-lbl">ICCID</span>
                          <span className="esim-row-val">
                            {esimData.iccid}
                            <button 
                              className="copy-btn-inline"
                              onClick={() => handleCopyText(esimData.iccid, 'mã ICCID')}
                              title="Sao chép ICCID"
                            >
                              <Copy size={13} />
                            </button>
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="esim-actions-row">
                        <button 
                          className="esim-action-btn primary"
                          onClick={handleTopup}
                        >
                          Nạp thêm
                        </button>
                        <button 
                          className="esim-action-btn outline"
                          onClick={() => {
                            if (esimData.qrcode) {
                              triggerNotification(`LPA Mã Kích hoạt: ${esimData.qrcodeContent}`, 'info');
                            } else {
                              triggerNotification('Mã QR đang được đồng bộ từ Worldmove...', 'info');
                            }
                          }}
                        >
                          Xem QR
                        </button>
                        <button 
                          className="esim-action-btn outline"
                          onClick={handleTopup}
                        >
                          Gia hạn
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: QR Code Box */}
                  <div className="qr-install-card-box">
                    <div className="qr-box-header">
                      <h4 className="qr-title-tooltip">
                        Mã QR cài đặt <Info size={14} style={{ color: 'var(--text-light)', cursor: 'pointer' }} />
                      </h4>
                      <p className="qr-subtitle-text">Quét mã QR bằng thiết bị của bạn để cài đặt eSIM.</p>
                    </div>

                    <div className="qr-code-img-wrapper" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '130px' }}>
                      <style>{`
                        @keyframes hico-spin {
                          0% { transform: rotate(0deg); }
                          100% { transform: rotate(360deg); }
                        }
                      `}</style>
                      {loadingEsimActivation ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          textAlign: 'center',
                          padding: '10px'
                        }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            border: '4px solid rgba(255, 79, 0, 0.1)',
                            borderTop: '4px solid #FF4F00',
                            borderRadius: '50%',
                            animation: 'hico-spin 1s linear infinite'
                          }}></div>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#FF4F00' }}>
                            Đang khởi tạo mã eSIM...<br/>
                            <span style={{ fontWeight: 'normal', color: 'var(--text-light)' }}>Vui lòng đợi vài giây</span>
                          </span>
                        </div>
                      ) : esimData.qrcode ? (
                        <img 
                          src={esimData.qrcode.startsWith('http') ? esimData.qrcode : 'http://localhost:5000' + esimData.qrcode} 
                          alt="eSIM QR Code" 
                          style={{ maxWidth: '120px', height: 'auto', borderRadius: '4px', border: '1px solid #e2e8f0', padding: '4px', backgroundColor: '#fff' }} 
                        />
                      ) : (
                        <svg width="110" height="110" viewBox="0 0 120 120">
                          <rect width="120" height="120" fill="white" />
                          <rect x="10" y="10" width="28" height="28" fill="black" rx="3" />
                          <rect x="16" y="16" width="16" height="16" fill="white" rx="1" />
                          <rect x="20" y="20" width="8" height="8" fill="black" rx="1" />
                          
                          <rect x="82" y="10" width="28" height="28" fill="black" rx="3" />
                          <rect x="88" y="16" width="16" height="16" fill="white" rx="1" />
                          <rect x="92" y="20" width="8" height="8" fill="black" rx="1" />
                          
                          <rect x="10" y="82" width="28" height="28" fill="black" rx="3" />
                          <rect x="16" y="88" width="16" height="16" fill="white" rx="1" />
                          <rect x="20" y="92" width="8" height="8" fill="black" rx="1" />
                          
                          <rect x="90" y="90" width="12" height="12" fill="black" rx="1" />
                          <rect x="94" y="94" width="4" height="4" fill="white" />
                          
                          <rect x="44" y="10" width="6" height="6" fill="black" />
                          <rect x="56" y="14" width="12" height="6" fill="black" />
                          <rect x="44" y="24" width="6" height="12" fill="black" />
                          <rect x="72" y="10" width="6" height="18" fill="black" />
                          <rect x="10" y="44" width="12" height="6" fill="black" />
                          <rect x="28" y="44" width="6" height="6" fill="black" />
                          <rect x="14" y="56" width="6" height="12" fill="black" />
                          <rect x="82" y="44" width="18" height="6" fill="black" />
                          <rect x="94" y="56" width="6" height="18" fill="black" />
                          <rect x="82" y="68" width="6" height="6" fill="black" />
                          <rect x="44" y="82" width="12" height="6" fill="black" />
                          <rect x="62" y="88" width="6" height="18" fill="black" />
                          <rect x="44" y="100" width="12" height="6" fill="black" />
                          
                          <circle cx="60" cy="60" r="16" fill="#ff3d00" />
                          <text x="60" y="64" fontFamily="var(--font-family)" fontWeight="900" fontSize="9" fill="white" textAnchor="middle">HICO</text>
                        </svg>
                      )}
                    </div>

                    <div className="qr-status-indicator">
                      <CheckCircle2 size={16} />
                      <span>Đã kích hoạt trên thiết bị này</span>
                    </div>

                    <button 
                      className="qr-setup-guide-btn"
                      onClick={() => triggerNotification('Đang mở hướng dẫn cài đặt eSIM từng bước!', 'info')}
                    >
                      <Smartphone size={14} /> Hướng dẫn cài đặt
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Orders Card */}
              <div className="dashboard-card-wrapper">
                <div className="card-header-row">
                  <h2 className="card-title-text">Đơn hàng gần đây</h2>
                  <a href="#/dashboard" onClick={(e) => { e.preventDefault(); triggerNotification('Hiển thị tất cả đơn hàng lịch sử!'); }} className="card-action-link">
                    Xem tất cả đơn hàng →
                  </a>
                </div>

                <div className="orders-table-wrapper">
                  <table className="orders-clean-table">
                    <thead>
                      <tr>
                        <th>Mã đơn hàng</th>
                        <th>Điểm đến</th>
                        <th>Gói cước</th>
                        <th>Ngày đặt</th>
                        <th>Trạng thái</th>
                        <th>Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const dynamicOrders = userOrders.map(o => {
                          const firstItem = o.items && o.items[0];
                          const isPhysical = o.simType === 'physical';
                          
                          let statusText = 'Hoàn thành';
                          let statusClass = 'active';
                          if (o.status === 'PENDING_CALLBACK') {
                            statusText = 'Đang khởi tạo';
                            statusClass = 'pending';
                          } else if (o.status === 'PENDING_QR_ASSIGN') {
                            statusText = 'Đang cấp QR';
                            statusClass = 'pending';
                          } else if (o.status === 'PENDING_SHIP') {
                            statusText = 'Chờ giao hàng';
                            statusClass = 'pending';
                          } else if (o.status === 'SHIPPED') {
                            statusText = 'Đang giao';
                            statusClass = 'active';
                          }

                          return {
                            code: o.orderId,
                            dest: isPhysical ? 'SIM Vật Lý' : (firstItem ? firstItem.productName.split(' ')[0] : 'eSIM Du Lịch'),
                            flag: isPhysical ? '📦' : '🗺️',
                            pkg: firstItem ? firstItem.productName : 'Gói cước du lịch',
                            date: o.createdAt ? o.createdAt.split(' ')[0] : new Date().toLocaleDateString('vi-VN'),
                            status: statusText,
                            statusClass: statusClass,
                            price: isPhysical ? 740000 : 490000
                          };
                        });
                        
                        const defaultOrders = [
                          { code: '#HICO-240512-0123', dest: 'Nhật Bản', flag: '🇯🇵', pkg: '10GB - 15 ngày', date: '12/05/2024', status: 'Đang sử dụng', statusClass: 'active', price: 490000 },
                          { code: '#HICO-240428-0098', dest: 'Hàn Quốc', flag: '🇰🇷', pkg: '5GB - 10 ngày', date: '28/04/2024', status: 'Hoàn thành', statusClass: 'active', price: 320000 },
                          { code: '#HICO-240415-0076', dest: 'Thái Lan', flag: '🇹🇭', pkg: '10GB - 15 ngày', date: '15/04/2024', status: 'Hoàn thành', statusClass: 'active', price: 390000 },
                          { code: '#HICO-240331-0055', dest: 'Việt Nam', flag: '🇻🇳', pkg: '3GB - 7 ngày', date: '31/03/2024', status: 'Đã huỷ', statusClass: 'cancelled', price: 140000 },
                        ];
                        
                        const mergedOrders = [...dynamicOrders, ...defaultOrders];
                        
                        return mergedOrders.map((order) => (
                          <tr key={order.code}>
                            <td className="order-code-text">{order.code}</td>
                            <td>
                              <span className="table-flag-inline">{order.flag}</span>
                              <span>{order.dest}</span>
                            </td>
                            <td>{order.pkg}</td>
                            <td>{order.date}</td>
                            <td>
                              <span className={`status-badge ${order.statusClass}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="order-price-bold">{order.price.toLocaleString('vi-VN')}đ</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Referral coupon and illustration Card */}
              <div className="promo-referral-banner-box">
                <div className="promo-banner-left">
                  <h3 className="promo-banner-heading">
                    <Gift size={20} /> Khuyến mãi & giới thiệu bạn bè
                  </h3>
                  <p className="promo-banner-desc">
                    Giới thiệu bạn bè sử dụng HICO eSIM. Nhận ngay 50.000đ vào ví cho mỗi lượt giới thiệu thành công. Bạn bè của bạn cũng sẽ nhận được 50.000đ khi thực hiện giao dịch đầu tiên!
                  </p>
                  <div className="promo-code-copy-row">
                    <div className="promo-code-input-box">HICOSON50</div>
                    <button 
                      className="promo-copy-btn"
                      onClick={() => handleCopyText('HICOSON50', 'mã giới thiệu')}
                    >
                      Sao chép
                    </button>
                  </div>
                </div>
                
                <div className="promo-banner-right">
                  {/* Visual Gift Illustration using seeded avatar image as dummy representative */}
                  <img src="/images/art_esim_intro.png" alt="Khuyến mãi" className="referral-illustration" />
                </div>
              </div>

            </div>

            {/* Right Column (Notifications, Next Trip, Hardware list, Support shortcuts, Profile security info) */}
            <div className="grid-right-col">
              
              {/* Notifications Card */}
              <div className="dashboard-card-wrapper">
                <div className="card-header-row">
                  <h2 className="card-title-text">Thông báo</h2>
                  <a href="#/dashboard" onClick={(e) => { e.preventDefault(); triggerNotification('Đã đánh dấu tất cả thông báo là đã đọc!', 'success'); }} className="card-action-link">
                    Đánh dấu tất cả đã đọc
                  </a>
                </div>

                <div className="notifications-list">
                  {/* Notification 1 */}
                  <div className="notification-item-box">
                    <div className="notification-icon-wrapper green">
                      <Check size={18} />
                    </div>
                    <div className="notification-body-text">
                      <h4 className="notification-item-title">eSIM Nhật Bản đã được kích hoạt</h4>
                      <p className="notification-item-desc">eSIM 10GB - 15 ngày của bạn đã được kích hoạt thành công trên thiết bị.</p>
                      <span className="notification-item-time">2 phút trước</span>
                    </div>
                  </div>

                  {/* Notification 2 */}
                  <div className="notification-item-box">
                    <div className="notification-icon-wrapper purple">
                      <Calendar size={18} />
                    </div>
                    <div className="notification-body-text">
                      <h4 className="notification-item-title">Nhắc nhở chuyến đi sắp tới</h4>
                      <p className="notification-item-desc">Chuyến đi Nhật Bản của bạn sẽ diễn ra sau 3 ngày nữa. Chuẩn bị kết nối mạng di động nhé.</p>
                      <span className="notification-item-time">1 giờ trước</span>
                    </div>
                  </div>

                  {/* Notification 3 */}
                  <div className="notification-item-box">
                    <div className="notification-icon-wrapper yellow">
                      <Star size={18} />
                    </div>
                    <div className="notification-body-text">
                      <h4 className="notification-item-title">Bạn đã nhận được 50 điểm</h4>
                      <p className="notification-item-desc">Cảm ơn bạn đã mua hàng. Điểm thưởng đã được tích luỹ vào tài khoản của bạn.</p>
                      <span className="notification-item-time">3 giờ trước</span>
                    </div>
                  </div>
                </div>

                <a 
                  href="#/dashboard" 
                  onClick={(e) => { e.preventDefault(); triggerNotification('Đang tải toàn bộ thông báo lịch sử...'); }}
                  className="card-action-link"
                  style={{ display: 'block', textAlign: 'center', marginTop: '16px', fontWeight: 'bold' }}
                >
                  Xem tất cả thông báo
                </a>
              </div>

              {/* Upcoming Trip Card */}
              <div className="dashboard-card-wrapper">
                <div className="card-header-row">
                  <h2 className="card-title-text">Chuyến đi sắp tới</h2>
                  <a href="#/dashboard" onClick={(e) => { e.preventDefault(); triggerNotification('Hiển thị tất cả lịch trình chuyến đi!'); }} className="card-action-link">
                    Xem tất cả →
                  </a>
                </div>

                <div className="upcoming-trip-card-box">
                  <img src="/images/dest_thailand.png" alt="Singapore" className="trip-thumbnail-img" />
                  <div className="trip-details-text">
                    <h4>Singapore</h4>
                    <p>20/05 - 26/05/2024</p>
                  </div>
                </div>

                <h4 className="recomended-title-sub">Gợi ý eSIM cho chuyến đi</h4>
                <div className="recommend-item-row">
                  <div className="recommend-item-info">
                    <h5>Singapore eSIM</h5>
                    <p>5GB - 7 ngày</p>
                  </div>
                <div className="recommend-price-capsule">
                    <span className="recommend-price-vnd">220.000đ</span>
                  </div>
                  <button 
                    className="recommend-add-btn"
                    onClick={() => handleAddEsimToCart('sg-esim-pkg-5gb', 'Singapore eSIM - Gói 5 GB (7 ngày)', 220000, '5 GB', '7 ngày')}
                    title="Thêm vào giỏ hàng"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Hardware devices recommendations Card */}
              <div className="dashboard-card-wrapper">
                <div className="card-header-row">
                  <h2 className="card-title-text">Thiết bị 4G/5G gợi ý cho bạn</h2>
                  <a href="#/dashboard" onClick={(e) => { e.preventDefault(); triggerNotification('Xem tất cả thiết bị phát WiFi'); }} className="card-action-link">
                    Xem tất cả →
                  </a>
                </div>

                <div className="hardware-horizontal-grid">
                  {/* Device 1 */}
                  <div className="hardware-card-box">
                    <span className="hardware-badge-best">Bán chạy</span>
                    <img src="/images/device_wifi_mini.png" alt="WiFi mini" className="hardware-img" />
                    <h4 className="hardware-title-text">Bộ phát WiFi 4G mini</h4>
                    <span className="hardware-price-text">890.000đ</span>
                    <button 
                      className="hardware-buy-btn"
                      onClick={() => handleAddHardwareToCart('hardware-wifi-mini', 'Bộ phát WiFi 4G mini', 890000, '/images/device_wifi_mini.png')}
                    >
                      Mua ngay
                    </button>
                  </div>

                  {/* Device 2 */}
                  <div className="hardware-card-box">
                    <img src="/images/device_wifi_home.png" alt="WiFi home" className="hardware-img" />
                    <h4 className="hardware-title-text">Router WiFi 4G gia đình</h4>
                    <span className="hardware-price-text">1.490.000đ</span>
                    <button 
                      className="hardware-buy-btn"
                      onClick={() => handleAddHardwareToCart('hardware-wifi-home', 'Router WiFi 4G gia đình', 1490000, '/images/device_wifi_home.png')}
                    >
                      Mua ngay
                    </button>
                  </div>

                  {/* Device 3 */}
                  <div className="hardware-card-box">
                    <img src="/images/device_usb_4g.png" alt="USB 4G" className="hardware-img" />
                    <h4 className="hardware-title-text">USB 4G LTE</h4>
                    <span className="hardware-price-text">690.000đ</span>
                    <button 
                      className="hardware-buy-btn"
                      onClick={() => handleAddHardwareToCart('hardware-usb-lte', 'USB 4G LTE', 690000, '/images/device_usb_4g.png')}
                    >
                      Mua ngay
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Support Shortcuts Card */}
              <div className="dashboard-card-wrapper">
                <div className="card-header-row">
                  <h2 className="card-title-text">Hỗ trợ nhanh</h2>
                </div>

                <div className="support-widget-list">
                  <div className="support-shortcut-item" onClick={() => triggerNotification('Đang mở form tạo yêu cầu hỗ trợ mới...', 'info')}>
                    <ClipboardList size={18} className="support-shortcut-icon" />
                    <div className="shortcut-text">
                      <h5>Tạo yêu cầu hỗ trợ</h5>
                      <p>Nhận hỗ trợ từ đội ngũ HICO</p>
                    </div>
                  </div>

                  <div className="support-shortcut-item" onClick={() => triggerNotification('Kết nối tới tổng đài hỗ trợ!', 'success')}>
                    <MessageSquare size={18} className="support-shortcut-icon" />
                    <div className="shortcut-text">
                      <h5>Trò chuyện với HICO <span className="status-badge active" style={{ fontSize: '9px', padding: '2px 6px', marginLeft: '6px' }}>Đang online</span></h5>
                      <p>Giải đáp thắc mắc của bạn trực tiếp</p>
                    </div>
                  </div>

                  <div className="support-shortcut-item" onClick={() => triggerNotification('Mở tài liệu Câu hỏi thường gặp FAQ', 'info')}>
                    <HelpCircle size={18} className="support-shortcut-icon" />
                    <div className="shortcut-text">
                      <h5>Câu hỏi thường gặp</h5>
                      <p>Xem các câu trả lời cho các vấn đề phổ biến</p>
                    </div>
                  </div>
                </div>

                <div className="ticket-status-card">
                  <h4 className="ticket-card-title">Yêu cầu gần đây</h4>
                  <div className="ticket-details-box">
                    <div className="ticket-id-row">
                      <span className="ticket-id">#TK-240512-0456</span>
                      <span className="ticket-badge">Đang xử lý</span>
                    </div>
                    <p className="ticket-update-time">Cập nhật: 12/05/2024 14:30</p>
                  </div>
                  <a href="#/dashboard" onClick={(e) => { e.preventDefault(); triggerNotification('Xem lịch sử tất cả phiếu yêu cầu hỗ trợ!'); }} className="card-action-link" style={{ display: 'block', textAlign: 'center', marginTop: '12px' }}>
                    Xem tất cả yêu cầu →
                  </a>
                </div>
              </div>

              {/* Account and profile security Card */}
              <div className="dashboard-card-wrapper">
                <div className="card-header-row">
                  <h2 className="card-title-text">Tài khoản & bảo mật</h2>
                </div>

                <div className="account-security-list">
                  {/* Email row */}
                  <div className="account-info-row">
                    <div className="account-info-left">
                      <Mail size={16} className="account-info-icon" />
                      <div className="account-label-text">
                        <h5>Email</h5>
                        <p>son.nguyen@gmail.com</p>
                      </div>
                    </div>
                    <span className="account-verified-badge success">Đã xác minh</span>
                  </div>

                  {/* Phone row */}
                  <div className="account-info-row">
                    <div className="account-info-left">
                      <Phone size={16} className="account-info-icon" />
                      <div className="account-label-text">
                        <h5>Số điện thoại</h5>
                        <p>+84 912 345 678</p>
                      </div>
                    </div>
                    <span className="account-verified-badge success">Đã xác minh</span>
                  </div>

                  {/* Payment row */}
                  <div className="account-info-row">
                    <div className="account-info-left">
                      <CreditCard size={16} className="account-info-icon" />
                      <div className="account-label-text">
                        <h5>Phương thức thanh toán</h5>
                        <p>VISA •••• 4242</p>
                      </div>
                    </div>
                    <span className="account-verified-badge default">Mặc định</span>
                  </div>
                </div>

                <a 
                  href="#/dashboard" 
                  onClick={(e) => { e.preventDefault(); triggerNotification('Đang mở trang cài đặt thông tin cá nhân!', 'info'); }}
                  className="card-action-link"
                  style={{ display: 'block', textAlign: 'center', marginTop: '16px', fontWeight: 'bold' }}
                >
                  Quản lý tài khoản →
                </a>
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* Floating Orange Chat Button */}
      <div 
        className="floating-chat-btn-box"
        onClick={() => triggerNotification('Mở hộp thoại Chat trực tuyến!', 'success')}
        title="Trò chuyện với HICO"
      >
        <MessageSquare size={22} />
      </div>
    </div>
  );
};

export default UserDashboard;
