import React, { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { Destinations } from './components/Destinations/Destinations';
import { FeaturedPackages } from './components/FeaturedPackages/FeaturedPackages';
import { HowItWorks } from './components/HowItWorks/HowItWorks';
import { WhyHico } from './components/WhyHico/WhyHico';

import { Testimonials } from './components/Testimonials/Testimonials';
import { Devices } from './components/Devices/Devices';
import { Articles, type Article } from './components/Articles/Articles';
import { Newsletter } from './components/Newsletter/Newsletter';
import { Footer } from './components/Footer/Footer';
import { CartDrawer } from './components/CartDrawer/CartDrawer';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { ProductDetail } from './components/ProductDetail/ProductDetail';
import { UserDashboard } from './components/UserDashboard/UserDashboard';
import { WifiOff, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import './App.css';
import { updateSeoTags } from './utils/seo';

export const App: React.FC = () => {
  const { isOnline, notification } = useApp();
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
      // Scroll to top when route changes
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    // Only run default SEO logic if we are NOT on a product page, NOT on admin dashboard, and NOT on user dashboard
    const isMainRoute = currentHash === '' || currentHash === '#/' || currentHash.startsWith('#/home');
    
    if (isMainRoute) {
      if (selectedArticle) {
        // If an article modal is open, set SEO to the article's SEO details
        const title = selectedArticle.seoTitle || `${selectedArticle.title} - Tin tức HICO`;
        const description = selectedArticle.seoDescription || `Đọc bài viết "${selectedArticle.title}" tại HICO. Cẩm nang du lịch và công nghệ eSIM hàng đầu.`;
        const keywords = selectedArticle.seoKeywords || `hico esim, tin tuc hico, ${selectedArticle.title.toLowerCase()}`;
        
        updateSeoTags({
          title,
          description,
          keywords
        });
      } else {
        // Otherwise, set to default homepage SEO values
        updateSeoTags({});
      }
    }
  }, [currentHash, selectedArticle]);

  const handleScrollToSection = (sectionId: string) => {
    if (window.location.hash.startsWith('#/product/')) {
      window.location.hash = '';
      setTimeout(() => {
        const section = document.getElementById(sectionId);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    } else {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const isProductPage = currentHash.startsWith('#/product/');

  if (currentHash === '#/admin') {
    return <AdminDashboard />;
  }

  if (currentHash === '#/dashboard') {
    return <UserDashboard />;
  }

  return (
    <div className="app-shell">
      {/* PWA Offline indicator */}
      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={16} />
          <span>Bạn đang ở chế độ ngoại tuyến. Một số tính năng có thể không hoạt động.</span>
        </div>
      )}

      {/* Global Toast Alert */}
      {notification && (
        <div className={`global-toast-notification ${notification.type} fade-in`}>
          {notification.type === 'success' && <CheckCircle2 size={18} className="toast-icon" />}
          {notification.type === 'info' && <Info size={18} className="toast-icon" />}
          {notification.type === 'error' && <AlertTriangle size={18} className="toast-icon" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Layout */}
      <Header onNavClick={handleScrollToSection} />

      {/* Main Content Sections */}
      <main className="main-content">
        {isProductPage ? (
          <ProductDetail />
        ) : (
          <>
            {/* Hero Section */}
            <Hero />

            {/* SECTION 1: Destinations (Left) & Featured Packages (Right) */}
            <section id="destinations-and-packages" className="section bg-alt section-split-dest-pkg">
              <div className="container split-dest-pkg-container">
                <div className="destinations-column">
                  <Destinations />
                </div>
                <div className="packages-column">
                  <FeaturedPackages />
                </div>
              </div>
            </section>

            {/* SECTION 2: How It Works (Left) & Why Choose HICO (Right) */}
            <section id="how-and-why" className="section section-split-how-why">
              <div className="container split-how-why-container">
                <div className="how-column">
                  <HowItWorks />
                </div>
                <div className="why-column">
                  <WhyHico />
                </div>
              </div>
            </section>

            {/* SECTION 3: Testimonials (Left) & Articles (Right) */}
            <section id="reviews-and-articles" className="section bg-alt section-split-app-rev-art">
              <div className="container split-app-rev-art-container">
                <div className="testimonials-column">
                  <Testimonials />
                </div>
                <div className="articles-column">
                  <Articles onSelectArticle={setSelectedArticle} />
                </div>
              </div>
            </section>

            {/* SECTION 4: Hardware Devices */}
            <Devices />

            {/* SECTION 5: Newsletter */}
            <Newsletter />
          </>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Cart Drawer */}
      <CartDrawer />

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div className="article-modal-overlay fade-in" onClick={() => setSelectedArticle(null)}>
          <div className="article-modal-content slide-up" onClick={(e) => e.stopPropagation()}>
            <button className="article-modal-close" onClick={() => setSelectedArticle(null)}>
              &times;
            </button>
            {selectedArticle.image && (
              <div className="article-modal-hero">
                <img src={selectedArticle.image} alt={selectedArticle.title} className="article-modal-image" />
                <div className="article-modal-hero-overlay" />
              </div>
            )}
            <div className="article-modal-body">
              <span className="article-modal-date">{selectedArticle.date}</span>
              <h2 className="article-modal-title">{selectedArticle.title}</h2>
              <div className="article-modal-divider" />
              <div 
                className="article-modal-text-content"
                dangerouslySetInnerHTML={{ __html: selectedArticle.content || '' }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
