import React from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, WifiOff } from 'lucide-react';
import { useApp } from '../context/useApp';
import { Header } from '../components/Header/Header';
import { Footer } from '../components/Footer/Footer';
import { CartDrawer } from '../components/CartDrawer/CartDrawer';
import { AdminDashboard } from '../components/Admin/AdminDashboard';
import { SeoHead } from '../seo/SeoHead';
import { defaultMetadata } from '../seo/buildMetadata';
import { HomePage } from '../pages/HomePage';
import { ArticleListPage, ArticlePage, CartPage, CoverageListPage, CoveragePage, NotFound, ProductListPage, ProductPage } from '../pages/PublicPages';
import { ScrollRestoration } from './ScrollRestoration';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { ForbiddenPage, LoginPage } from '../pages/LoginPage';
import '../App.css';

const PublicLayout = () => {
  const { isOnline, notification } = useApp();
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {!isOnline && <div className="offline-banner"><WifiOff size={16} /><span>Offline mode is active.</span></div>}
    {notification && <div className={`global-toast-notification ${notification.type} fade-in`}>{notification.type === 'success' && <CheckCircle2 size={18} className="toast-icon" />}{notification.type === 'info' && <Info size={18} className="toast-icon" />}{notification.type === 'error' && <AlertTriangle size={18} className="toast-icon" />}<span>{notification.message}</span></div>}
    <Header />
    <Outlet />
    <Footer />
  </div>;
};

const PrivateAdmin = () => <><SeoHead path="/quan-tri" metadata={{ ...defaultMetadata(), title: 'Admin | HICO eSIM', indexable: false }} noindex /><AdminDashboard /></>;

export const AppRouter: React.FC = () => <RouteErrorBoundary><ScrollRestoration /><Routes>
  <Route element={<PublicLayout />}>
    <Route index element={<><SeoHead path="/" metadata={defaultMetadata()} schema={{ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: 'HICO eSIM' }, { '@type': 'WebSite', name: 'HICO eSIM' }] }} /><main id="main-content" tabIndex={-1} className="main-content"><HomePage /></main></>} />
    <Route path="san-pham" element={<ProductListPage />} />
    <Route path="san-pham/:slug" element={<ProductPage />} />
    <Route path="diem-den" element={<CoverageListPage />} />
    <Route path="diem-den/:slug" element={<CoveragePage expectedType="country" />} />
    <Route path="khu-vuc/:slug" element={<CoveragePage expectedType="region" />} />
    <Route path="nap-them" element={<ProductListPage operation="topup" />} />
    <Route path="nap-them/:slug" element={<ProductPage />} />
    <Route path="thiet-bi" element={<ProductListPage operation="device_sale" />} />
    <Route path="thiet-bi/:slug" element={<ProductPage />} />
    <Route path="bai-viet" element={<ArticleListPage />} />
    <Route path="bai-viet/:slug" element={<ArticlePage />} />
    <Route path="gio-hang" element={<CartPage />} />
    <Route path="thanh-toan" element={<CartPage checkout />} />
    <Route path="404" element={<NotFound />} />
    <Route path="*" element={<NotFound />} />
  </Route>
  <Route path="quan-tri" element={<ProtectedRoute><PrivateAdmin /></ProtectedRoute>} />
  <Route path="dang-nhap" element={<LoginPage />} />
  <Route path="khong-co-quyen" element={<ForbiddenPage />} />
</Routes><CartDrawer /></RouteErrorBoundary>;
