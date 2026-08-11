import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getCanonicalProductPath } from '../../routing/canonicalRoute';
import { getPublicProducts } from '../../services/publicSeoApi';
import { getProductMedia } from '../../utils/productMedia';
import type { PublicProduct } from '../../types/publicCatalog';
import './FeaturedPackages.css';

export const FeaturedPackages: React.FC = () => {
  const [packages, setPackages] = useState<PublicProduct[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    getPublicProducts(controller.signal).then((items) => setPackages(items.filter((product) => product.operation === 'new_subscription' && product.coverageType !== 'country').slice(0, 4))).catch(() => setPackages([]));
    return () => controller.abort();
  }, []);
  return <div className="packages-block">
    <div className="section-title-wrapper"><div><h2 className="section-title">Goi noi bat</h2></div><Link to="/san-pham" className="section-view-all">Xem tat ca <ArrowRight size={16} /></Link></div>
    <div className="packages-stack">{packages.map((item) => {
      const prices = item.variants.map((variant) => variant.price).filter(Number.isFinite);
      return <Link key={item.id} className="package-horizontal-card" to={getCanonicalProductPath(item)}><div className="package-left-icon-box"><img src={getProductMedia(item)} alt="" /></div><div className="package-right-details"><div className="package-text-info"><h3>{item.name}</h3><span className="pkg-coverage-text">{item.coverageType === 'global' ? 'Toàn cầu' : 'Khu vực'}</span><div className="pkg-badges-row"><span className="pkg-badge duration">{item.variantCount} gói</span></div></div><div className="package-price-arrow-row"><span className="pkg-price-text">{prices.length ? Math.min(...prices).toLocaleString('vi-VN') : '0'} {item.variants[0]?.currency || 'VND'}</span><span className="pkg-arrow-btn"><ArrowRight size={14} /></span></div></div></Link>;
    })}</div>
  </div>;
};
