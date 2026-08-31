import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Wifi } from 'lucide-react';
import { useApp } from '../../context/useApp';
import { getCanonicalProductPath } from '../../routing/canonicalRoute';
import { getPublicProducts } from '../../services/publicSeoApi';
import { getProductMedia } from '../../utils/productMedia';
import type { PublicProduct } from '../../types/publicCatalog';
import './Destinations.css';

export const Destinations: React.FC = () => {
  const { searchQuery, setSearchQuery } = useApp();
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getPublicProducts(controller.signal).then((items) => setProducts(items.filter((product) => product.operation === 'new_subscription' && product.coverageType === 'country'))).catch(() => setProducts([]));
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(searchQuery.toLowerCase())), [products, searchQuery]);
  const displayed = showAll || searchQuery ? filtered : filtered.slice(0, 8);
  return (
    <div className="destinations-block">
      <div className="section-title-wrapper"><div><h2 className="section-title">Diem den pho bien</h2></div>{(searchQuery || showAll) ? <button className="clear-search-btn" onClick={() => { setSearchQuery(''); setShowAll(false); }}>Thu gon</button> : <button className="section-view-all" onClick={() => setShowAll(true)}>Xem tat ca <ArrowRight size={16} /></button>}</div>
      {searchQuery && <div className="search-query-badge">Ket qua cho: <strong>{searchQuery}</strong> ({filtered.length})</div>}
      {displayed.length === 0 ? <div className="no-destinations-state"><Wifi size={40} className="no-results-icon" /><h3>Khong tim thay diem den</h3><p>Danh muc public dang duoc cap nhat.</p></div> : <div className="destinations-grid">{displayed.map((product) => {
        const prices = product.variants.map((variant) => variant.price).filter(Number.isFinite);
        const price = prices.length ? Math.min(...prices) : 0;
        return <Link key={product.id} className="destination-card" to={getCanonicalProductPath(product)}>
          <div className="dest-image-box"><img src={getProductMedia(product)} alt={product.name} className="dest-image" loading="lazy" /></div>
          <div className="dest-details"><h3 className="dest-name"><span>{product.name}</span></h3><div className="dest-specs"><span>{product.variantCount} gói sẵn sàng</span></div><div className="dest-footer"><span className="dest-price">{price.toLocaleString('vi-VN')} {product.variants[0]?.currency || 'VND'}</span><span className="dest-action-btn"><ArrowRight size={16} /></span></div></div>
        </Link>;
      })}</div>}
    </div>
  );
};
