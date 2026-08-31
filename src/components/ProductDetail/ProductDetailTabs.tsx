import { useState } from 'react';
import type { ProductReview } from '../../types/legacy';
import type { PublicProduct, PublicVariant } from '../../types/publicCatalog';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { Database, Globe, HardDrive, Radio, Settings, ShieldCheck, Zap } from 'lucide-react';

export type SpecsTabKey = 'kythuat' | 'caidat' | 'tuongthich' | 'danhgia' | 'faq';

interface ProductSpecsTabProps {
  product: PublicProduct;
  variant: PublicVariant | null;
}

const Star = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#FF9F00' : 'none'} stroke="#FF9F00" strokeWidth="1.5">
    <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 21 12 17.8 5.5 21 7 14.5 2 9.5 9 9 12 2" />
  </svg>
);

interface SpecRow {
  icon: typeof Database;
  label: string;
  value: string;
}
const buildRows = (product: PublicProduct, variant: PublicVariant | null): SpecRow[] => {
  const rows: SpecRow[] = [
    { icon: Database, label: 'Sản phẩm', value: product.name },
    { icon: HardDrive, label: 'SKU', value: variant?.sku || '-' },
  ];
  if (variant?.dataLimit) rows.push({ icon: Database, label: 'Dung lượng', value: variant.dataLimit });
  if (variant?.duration) rows.push({ icon: Settings, label: 'Thời hạn', value: variant.duration });
  if (variant?.speedLabel || product.speedLabel) rows.push({ icon: Zap, label: 'Tốc độ', value: variant?.speedLabel ?? product.speedLabel ?? '-' });
  if (variant?.medium) {
    const lbl = variant.medium === 'physical_sim' ? 'SIM vật lý' : 'eSIM';
    rows.push({ icon: Radio, label: 'Loại SIM', value: lbl });
  }
  if (variant?.networkLabel || product.networkLabel) rows.push({ icon: Globe, label: 'Mạng', value: variant?.networkLabel ?? product.networkLabel ?? '-' });
  if (variant?.hotspotSupport || product.hotspotSupport) rows.push({ icon: Settings, label: 'Hotspot', value: variant?.hotspotSupport ?? product.hotspotSupport ?? '-' });
  rows.push({ icon: ShieldCheck, label: 'Fulfillment', value: variant?.fulfillmentMethod || '-' });
  return rows;
};
export const ProductSpecsTab = ({ product, variant }: ProductSpecsTabProps) => {
  const rows = buildRows(product, variant);
  return (
    <div className="pdp-specs-grid">
      <div className="pdp-specs-list">
        <h4 className="pdp-section-heading">Thông tin gói đã chọn</h4>
        <div className="pdp-specs-rows">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="pdp-specs-row">
              <span className="pdp-specs-label">
                <Icon size={14} aria-hidden="true" />
                {label}
              </span>
              <span className="pdp-specs-value">{value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="pdp-specs-aside">
        <h4 className="pdp-section-heading">Variant dang chon</h4>
        {variant ? (
          <div className="pdp-specs-card">
            <strong className="pdp-specs-card-title">{variant.dataLimit ?? variant.deviceSpecifications?.model ?? variant.sku}</strong>
            <span className="pdp-specs-card-meta">{variant.duration ?? 'Theo goi'} - {variant.medium === 'physical_sim' ? 'SIM vật lý' : 'eSIM'}</span>
            <span className="pdp-specs-card-price">{variant.price.toLocaleString('vi-VN')} {variant.currency}</span>
          </div>
        ) : (
          <p className="pdp-empty">Chưa có variant public khả dụng.</p>
        )}
      </div>
    </div>
  );
};
interface ProductInstallTabProps { product: PublicProduct; }
export const ProductInstallTab = ({ product }: ProductInstallTabProps) => {
  const html = product.installationGuide || product.guide;
  return (
    <div className="pdp-tab-panel">
      <h4 className="pdp-section-heading">Hướng dẫn cài đặt</h4>
      {html ? <div className="pdp-rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} /> : <p className="pdp-empty">Đang cập nhật.</p>}
    </div>
  );
};

interface ProductCompatTabProps { product: PublicProduct; }
export const ProductCompatTab = ({ product }: ProductCompatTabProps) => {
  const html = product.compatibilityContent;
  const fallback = product.deviceSpecs?.simCompatibility;
  return (
    <div className="pdp-tab-panel">
      <h4 className="pdp-section-heading">Thiết bị tương thích</h4>
      {html ? <div className="pdp-rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} /> : <p className="pdp-empty">{fallback ?? 'Can ho tro eSIM.'}</p>}
    </div>
  );
};

interface ProductFaqTabProps { product: PublicProduct; }
export const ProductFaqTab = ({ product }: ProductFaqTabProps) => {
  const items = (product.faqItems ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  if (items.length === 0) {
    return (
      <div className="pdp-tab-panel">
        <h4 className="pdp-section-heading">Câu hỏi thường gặp</h4>
        <p className="pdp-empty">Đang cập nhật.</p>
      </div>
    );
  }
  return (
    <div className="pdp-tab-panel">
      <h4 className="pdp-section-heading">Câu hỏi thường gặp</h4>
      <div className="pdp-faq-list">
        {items.map((item, index) => (
          <details key={`${item.question}-${index}`} className="pdp-faq-item">
            <summary>{item.question}</summary>
            <div className="pdp-faq-answer" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.answer) }} />
          </details>
        ))}
      </div>
    </div>
  );
};
interface ProductReviewsTabProps {
  product: PublicProduct;
  reviews: ProductReview[];
}

export const ProductReviewsTab = ({ product, reviews }: ProductReviewsTabProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5, userName: name, userEmail: email, content, images: [] }),
      });
      if (!response.ok) throw new Error('Cannot submit');
      setName(''); setEmail(''); setContent(''); setIsFormOpen(false);
    } catch { setSubmitError('Không thể gửi đánh giá.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="pdp-tab-panel pdp-reviews-tab">
      <div className="pdp-reviews-header">
        <div>
          <h4 className="pdp-section-heading">Đánh giá sản phẩm</h4>
          <span className="pdp-reviews-count">{reviews.length.toLocaleString('vi-VN')} danh gia da duyet</span>
        </div>
        <button type="button" className="pdp-write-review-btn" onClick={() => setIsFormOpen(v => !v)}>Viết đánh giá</button>
      </div>
      {isFormOpen && (
        <form className="pdp-review-form" onSubmit={handleSubmit}>
          <h5 className="pdp-review-form-title">Đánh giá của bạn</h5>
          <div className="pdp-review-form-grid">
            <label className="pdp-review-form-group">
              <span>Ten</span>
              <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label className="pdp-review-form-group">
              <span>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label className="pdp-review-form-group pdp-review-form-group--full">
              <span>Noi dung</span>
              <textarea rows={4} value={content} onChange={e => setContent(e.target.value)} required />
            </label>
          </div>
          {submitError && <p className="pdp-review-form-error">{submitError}</p>}
          <button type="submit" className="pdp-review-form-submit" disabled={submitting}>
            {submitting ? 'Đang gửi...' : 'Gửi đánh giá chờ duyệt'}
          </button>
        </form>
      )}
      <div className="pdp-reviews-feed">
        {reviews.length === 0 ? (
          <div className="pdp-reviews-empty"><p>Chưa có đánh giá nào được phê duyệt.</p></div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="pdp-review-card">
              <div className="pdp-review-header">
                <div className="pdp-review-author">
                  <span className="pdp-review-avatar" aria-hidden="true">{review.userName.substring(0, 1).toUpperCase()}</span>
                  <div><strong>{review.userName}</strong><span>{review.createdAt}</span></div>
                </div>
                <div className="pdp-review-stars">{[1,2,3,4,5].map(p => <Star key={p} filled={p <= review.rating} />)}</div>
              </div>
              <p className="pdp-review-content">{review.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
interface ProductDetailTabsProps {
  product: PublicProduct;
  variant: PublicVariant | null;
  reviews: ProductReview[];
}

export const ProductDetailTabs = ({ product, variant, reviews }: ProductDetailTabsProps) => {
  const [active, setActive] = useState<SpecsTabKey>('kythuat');
  const tabs: Array<[SpecsTabKey, string]> = [
    ['kythuat', 'Thông tin kỹ thuật'],
    ['caidat', 'Hướng dẫn cài đặt'],
    ['tuongthich', 'Tương thích'],
    ['danhgia', `Đánh giá (${reviews.length.toLocaleString('vi-VN')})`],
    ['faq', 'Câu hỏi thường gặp'],
  ];
  return (
    <section className="pdp-tabs" aria-label="Thông tin chi tiết">
      <div className="pdp-tabs-header" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={active === key} className={`pdp-tabs-btn${active === key ? ' is-active' : ''}`} onClick={() => setActive(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="pdp-tabs-panel" role="tabpanel">
        {active === 'kythuat' && <ProductSpecsTab product={product} variant={variant} />}
        {active === 'caidat' && <ProductInstallTab product={product} />}
        {active === 'tuongthich' && <ProductCompatTab product={product} />}
        {active === 'danhgia' && <ProductReviewsTab product={product} reviews={reviews} />}
        {active === 'faq' && <ProductFaqTab product={product} />}
      </div>
    </section>
  );
};

export default ProductDetailTabs;
