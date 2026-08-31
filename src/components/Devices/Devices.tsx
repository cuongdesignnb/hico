import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { getPublicProducts } from '../../services/publicCatalogApi';
import { getCanonicalProductPath } from '../../routing/canonicalRoute';
import { getProductMedia } from '../../utils/productMedia';
import type { PublicProduct } from '../../types/publicCatalog';
import './Devices.css';

export const Devices: React.FC = () => {
  const [products, setProducts] = useState<PublicProduct[] | null>(null);
  const [generation, setGeneration] = useState<'all' | '4G' | '5G'>('all');
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { const controller = new AbortController(); getPublicProducts({ operation: 'device_sale' }, controller.signal).then(setProducts).catch(() => setProducts([])); return () => controller.abort(); }, []);
  const filtered = useMemo(() => (products ?? []).filter((product) => generation === 'all' || product.variants.some((variant) => variant.deviceSpecs?.networkGeneration === generation)), [generation, products]);
  const visible = showAll ? filtered : filtered.slice(0, 4);
  return <section className="section devices-section"><div className="container"><div className="devices-header-wrapper"><div className="devices-header-title"><h2 className="section-title">Thiết bị mạng 4G/5G</h2><p className="section-subtitle">Chỉ hiển thị thiết bị đã được publish từ canonical catalog.</p></div></div><div className="devices-filters"><button type="button" className={`filter-tab ${generation === 'all' ? 'active' : ''}`} onClick={() => setGeneration('all')}>Tất cả</button><button type="button" className={`filter-tab ${generation === '4G' ? 'active' : ''}`} onClick={() => setGeneration('4G')}>4G</button><button type="button" className={`filter-tab ${generation === '5G' ? 'active' : ''}`} onClick={() => setGeneration('5G')}>5G</button></div>{products === null ? <div className="route-state compact" role="status">Đang tải thiết bị...</div> : visible.length === 0 ? <div className="route-state compact"><h3>Chưa có thiết bị public</h3><p>Dữ liệu thiết bị canonical đang chờ Admin review; không hiển thị sản phẩm mẫu.</p></div> : <div className="devices-grid">{visible.map((product) => { const variant = product.variants[0]; return <Link key={product.id} to={getCanonicalProductPath(product)} className="device-card"><div className="device-img-box"><img src={getProductMedia(product)} alt={product.name} className="device-image" loading="lazy" /></div><div className="device-details-box"><h3 className="device-title-text">{product.name}</h3><p>{variant?.deviceSpecs?.networkGeneration || 'Thiết bị mạng'}</p><div className="device-card-footer"><span className="price-tag">{variant ? `${variant.price.toLocaleString('vi-VN')} ${variant.currency}` : 'Xem chi tiết'}</span><span className="device-buy-btn"><ArrowRight size={16} /> Xem</span></div></div></Link>; })}</div>}{filtered.length > 4 && <div className="devices-show-more-container"><button type="button" className="devices-toggle-btn" onClick={() => setShowAll(!showAll)}>{showAll ? 'Thu gọn danh sách' : `Xem tất cả (${filtered.length}) thiết bị`}{showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></div>}</div></section>;
};
