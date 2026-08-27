import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Clock, Database, Globe, HardDrive, Headphones, Mail, MapPin,
  Minus, Plus, Radio, Settings, ShieldCheck, Star, Users, Zap,
} from 'lucide-react';
import { useApp } from '../../context/useApp';
import { useProductVariantSelection } from '../../hooks/catalog/useProductVariantSelection';
import { getProductMedia } from '../../utils/productMedia';
import type { PublicProduct, PublicPurchaseOption, PublicVariant } from '../../types/publicCatalog';
import type { ProductReview } from '../../types/legacy';
import { productCategoryLabel, toProductDetailViewModel } from '../../adapters/productDetailViewModel';
import { fulfillmentLabelForPurchase, labelForPurchase } from '../../utils/cartItemClassification';
import './ProductDetail.css';
import { getCanonicalProductPath } from '../../routing/canonicalRoute';
import { resolveVariantForTripDay } from '../../utils/productTripDay';

type DetailTab = 'kythuat' | 'caidat' | 'tuongthich' | 'danhgia' | 'faq';

const uniqueValues = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];
const htmlToText = (value: string | undefined) => value?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';

export const ProductDetail = ({ product }: { product: PublicProduct }) => {
  const { addToCart, setIsCartOpen, triggerNotification } = useApp();
  const fallbackPurchaseOptions = useMemo<PublicPurchaseOption[]>(() => [{
    productId: product.id,
    slug: product.slug,
    action: product.medium === 'esim' ? 'buy_esim' as const : 'buy_physical_sim' as const,
    operation: product.operation,
    medium: product.medium ?? null,
    label: labelForPurchase({ operation: product.operation, medium: product.medium ?? null }),
    variants: product.variants,
  }], [product]);
  const purchaseOptions: PublicPurchaseOption[] = product.purchaseOptions?.length ? product.purchaseOptions : fallbackPurchaseOptions;
  const [selectedOption, setSelectedOption] = useState<{ productId: string; action: string } | null>(null);
  const selectedAction = selectedOption?.productId === product.id ? selectedOption.action : purchaseOptions[0]?.action ?? null;
  const activePurchaseOption = purchaseOptions.find((option) => option.action === selectedAction) ?? purchaseOptions[0];
  const activeProductReference = [product, ...(product.familyProducts ?? [])].find((candidate) => candidate.id === activePurchaseOption?.productId);
  const displayProduct: PublicProduct = activePurchaseOption
    ? { ...product, id: activePurchaseOption.productId, slug: activePurchaseOption.slug, name: activeProductReference?.name ?? product.name, operation: activePurchaseOption.operation, medium: activePurchaseOption.medium, variants: activePurchaseOption.variants }
    : product;
  const { variant: selectedVariant, variantId, setVariantId } = useProductVariantSelection(displayProduct);
  const variant = useMemo(() => selectedVariant
    ? { ...selectedVariant, fulfillmentMethod: fulfillmentLabelForPurchase({ operation: displayProduct.operation, medium: selectedVariant.medium ?? displayProduct.medium ?? null }) }
    : selectedVariant, [displayProduct.medium, displayProduct.operation, selectedVariant]);
  const viewModel = toProductDetailViewModel(displayProduct);
  const selectedViewVariant = viewModel.variants.find((item) => item.id === variantId) ?? viewModel.variants[0];
  const [selectedImage, setSelectedImage] = useState(viewModel.primaryImage);
  const [quantity, setQuantity] = useState(1);
  const [requestedTripDays, setRequestedTripDays] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<DetailTab>('kythuat');
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedImage(viewModel.primaryImage);
      setQuantity(1);
      setRequestedTripDays(undefined);
      setActiveTab('kythuat');
      setIsDescExpanded(false);
    });
  }, [displayProduct.id, viewModel.primaryImage]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => setReviews([]));
    fetch(`/api/products/${product.id}/reviews`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Không thể tải đánh giá.');
        return response.json() as Promise<ProductReview[]>;
      })
      .then((rows) => setReviews(Array.isArray(rows) ? rows : []))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setReviews([]);
      });
    return () => controller.abort();
  }, [product.id]);

  const variants = viewModel.variants;
  const tripDayChoices = useMemo(() => [...new Set(displayProduct.variants
    .filter((item) => item.medium === 'esim'
      && (!variant?.dataLimit || item.dataLimit === variant?.dataLimit)
      && (!displayProduct.dataPolicy || (item.dataPolicy ?? displayProduct.dataPolicy) === (variant?.dataPolicy ?? displayProduct.dataPolicy)))
    .flatMap((item) => item.tripDayOptions ?? [])
    .filter((value) => Number.isInteger(value) && value > 0))].sort((left, right) => left - right), [displayProduct.variants, displayProduct.dataPolicy, variant]);
  const hasTripDaySelector = displayProduct.operation === 'new_subscription' && tripDayChoices.length > 1;
  const simTypes = uniqueValues(variants.map((item) => item.simTypeLabel));
  const dataLimits = uniqueValues(variants.map((item) => item.dataLimitLabel));
  const durations = uniqueValues(variants.map((item) => item.durationLabel));
  const currentSimType = selectedViewVariant?.simTypeLabel;
  const currentDataLimit = selectedViewVariant?.dataLimitLabel;
  const currentDuration = selectedViewVariant?.durationLabel;
  const currentVariantAvailable = selectedViewVariant?.availability === 'available';
  const physical = displayProduct.operation === 'device_sale' || (displayProduct.operation === 'new_subscription' && variant?.medium === 'physical_sim');
  const categoryLabel = productCategoryLabel(displayProduct);
  const purchaseLabel = labelForPurchase({ operation: displayProduct.operation, medium: variant?.medium ?? displayProduct.medium ?? null });
  const fulfillmentLabel = fulfillmentLabelForPurchase({ operation: displayProduct.operation, medium: variant?.medium ?? displayProduct.medium ?? null });
  const effectiveQuantity = variant?.medium === 'esim' ? 1 : quantity;
  const shortDescription = viewModel.description || `Thông tin ${categoryLabel.toLowerCase()} được lấy từ dữ liệu canonical của HICO.`;

  const selectVariant = (predicate: (item: PublicVariant) => boolean) => {
    const next = displayProduct.variants.find((item) => predicate(item));
    if (next) {
      setRequestedTripDays(undefined);
      setVariantId(next.id);
    }
  };

  const handleSimTypeClick = (label: string) => {
    selectVariant((item) =>
      (item.medium === 'physical_sim' ? 'SIM vật lý' : item.medium === 'esim' ? 'eSIM' : 'Gói canonical') === label
      && (!currentDataLimit || item.dataLimit === currentDataLimit)
      && (!currentDuration || item.duration === currentDuration));
    if (!displayProduct.variants.some((item) => (item.medium === 'physical_sim' ? 'SIM vật lý' : item.medium === 'esim' ? 'eSIM' : 'Gói canonical') === label && item.dataLimit === currentDataLimit && item.duration === currentDuration)) {
      selectVariant((item) => (item.medium === 'physical_sim' ? 'SIM vật lý' : item.medium === 'esim' ? 'eSIM' : 'Gói canonical') === label);
    }
  };

  const handleDataLimitClick = (value: string) => {
    selectVariant((item) => item.dataLimit === value && (!currentSimType || (item.medium === 'physical_sim' ? 'SIM vật lý' : item.medium === 'esim' ? 'eSIM' : 'Gói canonical') === currentSimType) && (!currentDuration || item.duration === currentDuration));
    if (!displayProduct.variants.some((item) => item.dataLimit === value && item.duration === currentDuration)) selectVariant((item) => item.dataLimit === value);
  };

  const handleDurationClick = (value: string) => {
    selectVariant((item) => item?.duration === value && (!currentSimType || (item.medium === 'physical_sim' ? 'SIM vật lý' : item.medium === 'esim' ? 'eSIM' : 'Gói canonical') === currentSimType) && (!currentDataLimit || item.dataLimit === currentDataLimit));
    if (!displayProduct.variants.some((item) => item.duration === value && item.dataLimit === currentDataLimit)) selectVariant((item) => item?.duration === value);
  };

  const handleTripDayClick = (day: number) => {
    const matchingVariant = resolveVariantForTripDay({
      variants: displayProduct.variants,
      day,
      selectedVariant: variant,
      selectedDataPolicy: displayProduct.dataPolicy,
    });
    if (!matchingVariant) {
      triggerNotification('Ngày chuyến đi không có trong gói đang chọn.', 'error');
      return;
    }
    setRequestedTripDays(day);
    setVariantId(matchingVariant.id);
  };

  const cartItem = selectedViewVariant && variant ? {
    id: requestedTripDays ? `${variant.id}:trip:${requestedTripDays}` : variant.id,
    productId: displayProduct.id,
    variantId: variant.id,
    slug: displayProduct.slug,
    name: displayProduct.name,
    operation: displayProduct.operation,
    type: displayProduct.operation === 'device_sale' ? 'device' as const : variant.medium === 'physical_sim' ? 'physical' as const : 'esim' as const,
    medium: variant.medium ?? undefined,
    simType: selectedViewVariant.simTypeLabel,
    price: variant.price,
    displayedPrice: variant.price,
    currency: variant.currency,
    originalPrice: variant.compareAtPrice ?? undefined,
    duration: variant.duration ?? undefined,
    dataLimit: variant.dataLimit ?? undefined,
    ...(requestedTripDays ? { requestedTripDays } : {}),
    image: getProductMedia(displayProduct),
  } : null;

  const handleAddToCart = (openCart: boolean) => {
    if (variant?.medium === 'esim' && (variant.tripDayOptions?.length ?? 0) > 1 && requestedTripDays === undefined) {
      triggerNotification('Vui lòng chọn số ngày chuyến đi trước khi tiếp tục.', 'error');
      return;
    }
    if (!cartItem || !currentVariantAvailable) {
      triggerNotification('Gói sản phẩm hiện không khả dụng.', 'error');
      return;
    }
    for (let index = 0; index < effectiveQuantity; index += 1) addToCart(cartItem);
    if (openCart) setIsCartOpen(true);
  };

  const handleReviewSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingReview(true);
    try {
      const response = await fetch(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5, userName: reviewName, userEmail: reviewEmail, content: reviewContent, images: [] }),
      });
      if (!response.ok) throw new Error('Không thể gửi đánh giá.');
      setReviewName('');
      setReviewEmail('');
      setReviewContent('');
      setIsReviewFormOpen(false);
      triggerNotification('Đánh giá đã được gửi và chờ phê duyệt.');
    } catch {
      triggerNotification('Không thể gửi đánh giá. Vui lòng thử lại.', 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const renderHtml = (content: string | undefined, emptyMessage: string) => content
    ? <div className="rich-description-content" dangerouslySetInnerHTML={{ __html: content }} />
    : <p className="tab-desc-paragraph">{emptyMessage}</p>;

  if (displayProduct.operation === 'topup') {
    return (
      <div className="product-detail-page fade-in">
        <div className="container">
          <div className="product-retired-notice" role="status">
            <h1>{displayProduct.name}</h1>
            <p>Sản phẩm nạp SIM này đã ngừng mở bán. Vui lòng chọn một gói eSIM hoặc SIM vật lý đang hoạt động.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-page fade-in">
      <div className="container">
        <div className="breadcrumb-row">
          <span>Trang chủ</span><span className="breadcrumb-sep">&gt;</span>
          <span>{viewModel.coverageLabel}</span><span className="breadcrumb-sep">&gt;</span>
          <span className="breadcrumb-active">{displayProduct.name}</span>
        </div>

        <div className="product-main-grid">
          <div className="product-gallery-col">
            <div className="gallery-main-box">
              <img src={selectedImage} alt={displayProduct.name} className="gallery-main-img" />
              <div className="gallery-overlay">
                <div className="overlay-flag-title">
                  <span className="overlay-flag"><MapPin size={20} /></span>
                  <div><h2 className="overlay-title-large">{displayProduct.name.toUpperCase()}</h2><p className="overlay-subtitle-large">{categoryLabel}</p></div>
                </div>
              </div>
              <div className="gallery-badge-row">
                <span className="gallery-badge"><Check size={12} /> Canonical</span>
                <span className="gallery-badge"><Check size={12} /> {physical ? 'Giao hàng' : 'Kích hoạt nhanh'}</span>
                <span className="gallery-badge"><Check size={12} /> Hỗ trợ HICO</span>
              </div>
            </div>
            {viewModel.gallery.length > 1 && <div className="gallery-thumb-list">
              {viewModel.gallery.map((image) => <button key={image.url} type="button" className={`gallery-thumb-item ${selectedImage === image.url ? 'active' : ''}`} onClick={() => setSelectedImage(image.url)} aria-label={`Xem ảnh ${image.title}`}><img src={image.url} alt="" className="gallery-thumb-img" /></button>)}
            </div>}
          </div>

          <div className="product-info-col">
            {(selectedViewVariant?.networkLabel || selectedViewVariant?.apn || selectedViewVariant?.publicNote) && <div className="checkout-meta-list product-variant-metadata"><>{selectedViewVariant.networkLabel && <div className="checkout-meta-item"><Radio size={14} className="meta-check-icon" /><span>{selectedViewVariant.networkLabel}</span></div>}{selectedViewVariant.apn && <div className="checkout-meta-item"><Settings size={14} className="meta-check-icon" /><span>APN: {selectedViewVariant.apn}</span></div>}{selectedViewVariant.publicNote && <div className="checkout-meta-item"><Check size={14} className="meta-check-icon" /><span>{selectedViewVariant.publicNote}</span></div>}</></div>}
            <h1 className="product-title-text">{displayProduct.name}</h1>
            <div className="product-rating-row" aria-label={`${reviews.length} đánh giá`}>
              <div className="star-rating">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} stroke="#FF9F00" />)}</div>
              <span className="rating-count">({reviews.length} đánh giá)</span>
            </div>
            <p className="product-short-desc">{htmlToText(shortDescription).slice(0, 360)}</p>

            <div className="features-grid">
              <div className="feature-item"><Globe size={18} className="feature-icon" /><div><span className="feat-lbl">Loại sản phẩm</span><span className="feat-val">{categoryLabel}</span></div></div>
              <div className="feature-item"><Clock size={18} className="feature-icon" /><div><span className="feat-lbl">Fulfillment</span><span className="feat-val">{variant?.fulfillmentMethod || 'Canonical'}</span></div></div>
              <div className="feature-item"><Radio size={18} className="feature-icon" /><div><span className="feat-lbl">Tiền tệ</span><span className="feat-val">{variant?.currency || 'VND'}</span></div></div>
              <div className="feature-item"><Headphones size={18} className="feature-icon" /><div><span className="feat-lbl">Trạng thái</span><span className="feat-val">{currentVariantAvailable ? 'Có thể chọn' : 'Hết hàng'}</span></div></div>
            </div>

            {purchaseOptions.length > 1 && <div className="package-selector-section"><div className="package-selector-header"><h3 className="package-selector-title">Chọn cách sử dụng</h3><span className="package-badge-info">Theo gói đã chọn</span></div><div className="packages-card-grid">{purchaseOptions.map((option) => <button type="button" key={option.action} className={`package-card-option ${activePurchaseOption?.action === option.action ? 'selected' : ''}`} onClick={() => setSelectedOption({ productId: product.id, action: option.action })}><span className="pkg-card-limit">{option.label}</span><span className="pkg-card-duration">{option.medium === 'esim' ? 'Nhận eSIM online' : 'Giao SIM mới'}</span>{activePurchaseOption?.action === option.action && <span className="selected-check-indicator"><Check size={10} strokeWidth={3} /></span>}</button>)}</div></div>}
            {simTypes.length > 1 && <div className="package-selector-section"><div className="package-selector-header"><h3 className="package-selector-title">Chọn loại SIM</h3><span className="package-badge-info">Dữ liệu canonical</span></div><div className="packages-card-grid">{simTypes.map((type) => <button type="button" key={type} className={`package-card-option ${currentSimType === type ? 'selected' : ''}`} onClick={() => handleSimTypeClick(type)}><span className="pkg-card-limit">{type}</span><span className="pkg-card-duration">{type === 'SIM vật lý' ? 'Giao hàng tận nơi' : 'Theo gói hiện tại'}</span>{currentSimType === type && <span className="selected-check-indicator"><Check size={10} strokeWidth={3} /></span>}</button>)}</div></div>}

            {purchaseOptions.length <= 1 && displayProduct.familyProducts && displayProduct.familyProducts.length > 0 && <div className="package-selector-section"><div className="package-selector-header"><h3 className="package-selector-title">Phiên bản cùng họ gói</h3><span className="package-badge-info">Chọn đúng loại</span></div><div className="packages-card-grid">{displayProduct.familyProducts.map((familyProduct) => <Link className="package-card-option" key={familyProduct.id} to={getCanonicalProductPath(familyProduct)}><span className="pkg-card-limit">{labelForPurchase({ operation: familyProduct.operation, medium: familyProduct.medium })}</span><span className="pkg-card-duration">{familyProduct.name}</span></Link>)}</div></div>}

            {dataLimits.length > 0 && <div className="package-selector-section"><div className="package-selector-header"><h3 className="package-selector-title">Chọn dung lượng</h3><span className="package-badge-info">Theo variant</span></div><div className="packages-card-grid">{dataLimits.map((limit) => <button type="button" key={limit} className={`package-card-option ${currentDataLimit === limit ? 'selected' : ''}`} onClick={() => handleDataLimitClick(limit)}><span className="pkg-card-limit">{limit}</span><span className="pkg-card-duration">{currentSimType || categoryLabel}</span>{currentDataLimit === limit && <span className="selected-check-indicator"><Check size={10} strokeWidth={3} /></span>}</button>)}</div></div>}

            {durations.length > 0 && <div className="package-selector-section"><div className="package-selector-header"><h3 className="package-selector-title">Chọn thời hạn</h3></div><div className="packages-card-grid">{durations.map((duration) => { const supported = displayProduct.variants.some((item) => item.duration === duration && (!currentDataLimit || item.dataLimit === currentDataLimit)); return <button type="button" key={duration} disabled={!supported} className={`package-card-option ${currentDuration === duration ? 'selected' : ''} ${!supported ? 'disabled' : ''}`} onClick={() => supported && handleDurationClick(duration)}><span className="pkg-card-limit">{duration}</span>{currentDuration === duration && <span className="selected-check-indicator"><Check size={10} strokeWidth={3} /></span>}</button>; })}</div><p className="package-disclaimer-note">Thời hạn và điều kiện sử dụng lấy từ variant canonical hiện tại.</p></div>}

            {hasTripDaySelector && <div className="package-selector-section"><div className="package-selector-header"><h3 className="package-selector-title">Bạn đi bao nhiêu ngày?</h3><span className="package-badge-info">Chọn ngày chuyến đi</span></div><div className="packages-card-grid">{tripDayChoices.map((day) => <button type="button" key={day} className={`package-card-option ${requestedTripDays === day ? 'selected' : ''}`} onClick={() => handleTripDayClick(day)}><span className="pkg-card-limit">{day} ngày</span>{requestedTripDays === day && <span className="selected-check-indicator"><Check size={10} strokeWidth={3} /></span>}</button>)}</div><p className="package-disclaimer-note">Số ngày chuyến đi dùng để chọn đúng gói canonical, không phải thời hạn eSIM do Provider cấp.</p></div>}

            {dataLimits.length === 0 && durations.length === 0 && variants.length > 1 && <div className="package-selector-section"><div className="package-selector-header"><h3 className="package-selector-title">Chọn phiên bản</h3></div><div className="packages-card-grid">{variants.map((item) => <button type="button" key={item.id} className={`package-card-option ${item.id === variantId ? 'selected' : ''}`} onClick={() => { setRequestedTripDays(undefined); setVariantId(item.id); }}><span className="pkg-card-limit">{item.deviceModelLabel || item.sku}</span><span className="pkg-card-duration">{item.currency}</span></button>)}</div></div>}
          </div>

            <div className="product-checkout-col"><div className="checkout-card-box"><span className="checkout-tag-label">{purchaseLabel}</span><div className="checkout-price-row"><span className="checkout-price">{variant ? `${(variant.price * effectiveQuantity).toLocaleString('vi-VN')} ${variant.currency}` : '—'}</span>{variant?.compareAtPrice && variant.compareAtPrice > variant.price && <span className="checkout-exchange-price">{variant.compareAtPrice.toLocaleString('vi-VN')} {variant.currency}</span>}</div><div className="checkout-meta-list"><div className="checkout-meta-item"><Check size={14} className="meta-check-icon" /><span>{selectedViewVariant?.dataLimitLabel || selectedViewVariant?.deviceModelLabel || product.name}</span></div><div className="checkout-meta-item"><Check size={14} className="meta-check-icon" /><span>{requestedTripDays ? `Số ngày chuyến đi: ${requestedTripDays} ngày` : selectedViewVariant?.durationLabel || (physical ? 'Có giao hàng' : 'Theo gói')}</span></div><div className="checkout-meta-item"><Check size={14} className="meta-check-icon" /><span>{fulfillmentLabel}</span></div></div>{variant?.medium === 'esim' ? <div className="checkout-quantity-row"><span className="qty-label">Số lượng</span><strong className="qty-number">1</strong></div> : <div className="checkout-quantity-row"><span className="qty-label">Số lượng</span><div className="qty-selectors"><button type="button" className="qty-btn" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label="Giảm số lượng"><Minus size={14} /></button><span className="qty-number">{quantity}</span><button type="button" className="qty-btn" onClick={() => setQuantity((value) => Math.min(99, value + 1))} aria-label="Tăng số lượng"><Plus size={14} /></button></div></div>}<div className="checkout-actions"><button type="button" className="checkout-btn primary" onClick={() => handleAddToCart(false)} disabled={!currentVariantAvailable}>Thêm vào giỏ hàng</button><button type="button" className="checkout-btn secondary" onClick={() => handleAddToCart(true)} disabled={!currentVariantAvailable}>Mua ngay</button></div><div className="checkout-footer-trust"><span className="trust-title">Thanh toán an toàn & bảo mật</span><div className="payment-gateways-strip"><span className="pay-tag">VISA</span><span className="pay-tag">Mastercard</span><span className="pay-tag">PayPal</span><span className="pay-tag">Apple Pay</span></div></div></div></div>
        </div>

        <div className="quick-benefits-strip"><div className="benefit-cell"><Mail className="benefit-icon" /><div><span className="benefit-title">{fulfillmentLabel}</span><span className="benefit-desc">Điều kiện lấy từ fulfillment canonical</span></div></div><div className="benefit-cell"><Globe className="benefit-icon" /><div><span className="benefit-title">Dữ liệu minh bạch</span><span className="benefit-desc">Sản phẩm và variant đang được publish</span></div></div><div className="benefit-cell"><Headphones className="benefit-icon" /><div><span className="benefit-title">Hỗ trợ HICO</span><span className="benefit-desc">Đội ngũ sẵn sàng hỗ trợ</span></div></div><div className="benefit-cell"><Settings className="benefit-icon" /><div><span className="benefit-title">Chọn đúng variant</span><span className="benefit-desc">Cart lưu productId và variantId</span></div></div></div>

        <div className="product-tabs-container"><div className={`tab-info-block description-card-panel ${isDescExpanded ? 'expanded' : 'collapsed'}`} style={{ marginBottom: '28px' }}><h4 className="tab-section-heading">Chi tiết sản phẩm</h4><div className="description-collapse-wrapper">{renderHtml(viewModel.description, 'Thông tin chi tiết sản phẩm đang được cập nhật.')}</div><button type="button" className="description-expand-action" onClick={() => setIsDescExpanded((value) => !value)}>{isDescExpanded ? 'Thu gọn' : 'Xem thêm'}</button></div><div className="tabs-header-strip">{([['kythuat', 'Thông số'], ['caidat', 'Cài đặt'], ['tuongthich', 'Tương thích'], ['danhgia', `Đánh giá (${reviews.length})`], ['faq', 'FAQ']] as const).map(([tab, label]) => <button type="button" key={tab} className={`tab-btn-item ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{label}</button>)}</div><div className="tab-contents-panel">{activeTab === 'danhgia' ? <div className="reviews-tab-container fade-in"><div className="reviews-summary-header"><div><h4 className="tab-section-heading">Đánh giá sản phẩm</h4><p className="summary-count-text">{reviews.length} đánh giá đã được phê duyệt</p></div><button type="button" className="write-review-toggle-btn" onClick={() => setIsReviewFormOpen((value) => !value)}>Viết đánh giá</button></div>{isReviewFormOpen && <form className="review-form-card" onSubmit={handleReviewSubmit}><h4 className="review-form-title">Đánh giá của bạn</h4><div className="review-form-grid-inputs"><div className="review-form-input-group"><label htmlFor="review-name">Tên</label><input id="review-name" value={reviewName} onChange={(event) => setReviewName(event.target.value)} required /></div><div className="review-form-input-group"><label htmlFor="review-email">Email</label><input id="review-email" type="email" value={reviewEmail} onChange={(event) => setReviewEmail(event.target.value)} required /></div><div className="review-form-input-group full-width"><label htmlFor="review-content">Nội dung</label><textarea id="review-content" rows={4} value={reviewContent} onChange={(event) => setReviewContent(event.target.value)} required /></div></div><button type="submit" className="review-form-submit-btn-action" disabled={isSubmittingReview}>{isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá chờ duyệt'}</button></form>}<div className="reviews-feed-list">{reviews.length === 0 ? <div className="no-reviews-feed-placeholder"><p>Chưa có đánh giá nào được phê duyệt cho sản phẩm này.</p></div> : reviews.map((review) => <div key={review.id} className="review-item-card-feed"><div className="review-item-header-feed"><div className="reviewer-info-left"><div className="reviewer-avatar-placeholder">{review.userName.substring(0, 1).toUpperCase()}</div><div><h5 className="reviewer-display-name">{review.userName}</h5><span className="review-item-date-feed">{review.createdAt}</span></div></div><div className="reviewer-item-stars-feed">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} fill={star <= review.rating ? '#FF9F00' : 'none'} stroke="#FF9F00" />)}</div></div><p className="review-item-content-feed">{review.content}</p></div>)}</div></div> : <div className="tab-bottom-grid fade-in"><div className="specs-card-details"><h4 className="specs-card-title">{activeTab === 'kythuat' ? 'Thông số kỹ thuật' : activeTab === 'caidat' ? 'Hướng dẫn cài đặt' : activeTab === 'tuongthich' ? 'Thiết bị tương thích' : 'Câu hỏi thường gặp'}</h4>{activeTab === 'kythuat' && <div className="specs-details-list"><div className="specs-detail-row"><span className="specs-lbl"><Database size={14} className="specs-icon-inline" />Sản phẩm</span><span className="specs-val">{product.name}</span></div><div className="specs-detail-row"><span className="specs-lbl"><Zap size={14} className="specs-icon-inline" />Loại</span><span className="specs-val">{categoryLabel}</span></div><div className="specs-detail-row"><span className="specs-lbl"><HardDrive size={14} className="specs-icon-inline" />SKU</span><span className="specs-val">{variant?.sku || '—'}</span></div><div className="specs-detail-row"><span className="specs-lbl"><ShieldCheck size={14} className="specs-icon-inline" />Fulfillment</span><span className="specs-val">{variant?.fulfillmentMethod || '—'}</span></div></div>}{activeTab === 'caidat' && renderHtml(viewModel.installationContent, 'Hướng dẫn cài đặt đang được cập nhật.')}{activeTab === 'tuongthich' && <p className="tab-desc-paragraph">{viewModel.compatibilityContent}</p>}{activeTab === 'faq' && <p className="tab-desc-paragraph">{viewModel.faqItems.length ? viewModel.faqItems.map((item) => `${item.question}: ${item.answer}`).join(' ') : 'FAQ đang được cập nhật từ nội dung canonical của sản phẩm.'}</p>}</div><div className="popular-card-box"><h4 className="popular-card-title">{activeTab === 'kythuat' ? 'Variant đang chọn' : 'Thông tin sản phẩm'}</h4><div className="popular-card-list">{selectedViewVariant ? <div className="popular-list-item"><span className="pop-desc">{selectedViewVariant.dataLimitLabel || selectedViewVariant.deviceModelLabel || selectedViewVariant.sku}</span><span className="pop-price">{selectedViewVariant.price.toLocaleString('vi-VN')} {selectedViewVariant.currency}</span></div> : <p className="tab-desc-paragraph">Chưa có variant public khả dụng.</p>}</div><button type="button" className="view-all-packages-outline" onClick={() => setActiveTab('danhgia')}>Xem đánh giá</button></div></div>}</div></div>

        <div className="brand-stats-row"><div className="stat-capsule-item"><Globe className="stat-capsule-icon" /><div><span className="stat-capsule-val">Canonical</span><span className="stat-capsule-lbl">Nguồn dữ liệu public</span></div></div><div className="stat-capsule-item"><Users className="stat-capsule-icon" /><div><span className="stat-capsule-val">{product.variantCount}</span><span className="stat-capsule-lbl">Variants public</span></div></div><div className="stat-capsule-item"><Star className="stat-capsule-icon" /><div><span className="stat-capsule-val">{reviews.length}</span><span className="stat-capsule-lbl">Đánh giá đã duyệt</span></div></div><div className="stat-capsule-item"><ShieldCheck className="stat-capsule-icon" /><div><span className="stat-capsule-val">{variant?.currency || 'VND'}</span><span className="stat-capsule-lbl">Currency của variant</span></div></div></div>
        <div className="promo-register-section"><div className="promo-register-left"><Mail size={40} className="promo-mail-icon" /><div><h3 className="promo-heading">Đăng ký nhận ưu đãi</h3><p className="promo-sub">Nhận thông tin sản phẩm và ưu đãi từ HICO.</p></div></div><div className="promo-register-right"><form onSubmit={(event) => { event.preventDefault(); triggerNotification('Đăng ký email nhận ưu đãi thành công!'); }} className="promo-form-field"><input type="email" placeholder="Nhập email của bạn" className="promo-input-email" required /><button type="submit" className="promo-submit-btn">Đăng ký</button></form></div></div>
      </div>
    </div>
  );
};

export default ProductDetail;
