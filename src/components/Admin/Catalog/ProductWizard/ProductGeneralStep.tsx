import type { ProductDraft } from '../../../../types/productWizard';
import type { CatalogDeviceSpecs } from '../../../../types/catalog';
import { MediaAssetField } from '../../media/MediaAssetField';
import { MediaGalleryField } from '../../media/MediaGalleryField';

interface ProductGeneralStepProps {
  product: ProductDraft;
  onChange: (changes: Partial<ProductDraft>) => void;
  onGenerateSlug: () => void;
}

const ProductGeneralStep = ({ product, onChange, onGenerateSlug }: ProductGeneralStepProps) => {
  const updateDeviceSpecification = <K extends keyof CatalogDeviceSpecs>(field: K, value: CatalogDeviceSpecs[K] | undefined) => {
    const current = product.deviceSpecifications ?? {};
    onChange({ deviceSpecifications: { ...current, [field]: value } });
  };

  return (
  <section className="product-wizard-step-content">
    <div className="product-wizard-section-heading">
      <span className="product-wizard-kicker">Bước 2</span>
      <h3>Thông tin chung</h3>
      <p>Slug chỉ thay đổi khi Admin chủ động tạo lại hoặc nhập slug mới.</p>
    </div>
    <div className="product-wizard-form-grid">
      <label className="product-wizard-field product-wizard-field-wide">
        <span>Tên sản phẩm <b>*</b></span>
        <input value={product.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="Ví dụ: eSIM Nhật Bản 10GB" />
      </label>
      <label className="product-wizard-field">
        <span>Slug <b>*</b></span>
        <input value={product.slug} onChange={(event) => onChange({ slug: event.target.value })} placeholder="esim-nhat-ban-10gb" />
        <button type="button" className="product-wizard-inline-button" onClick={onGenerateSlug}>Tạo slug từ tên</button>
      </label>
      <div className="product-wizard-field">
        <MediaAssetField value={product.primaryMediaId} legacyUrl={product.image} label="Ảnh đại diện" onChange={(primaryMediaId) => onChange({ primaryMediaId })} />
      </div>
      <label className="product-wizard-field product-wizard-field-wide">
        <span>Mô tả</span>
        <textarea rows={3} value={product.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Mô tả ngắn cho Admin và khách hàng." />
      </label>
      <label className="product-wizard-field product-wizard-field-wide">
        <span>Hướng dẫn sử dụng</span>
        <textarea rows={3} value={product.guide} onChange={(event) => onChange({ guide: event.target.value })} placeholder="Các bước kích hoạt hoặc lưu ý." />
      </label>
      <div className="product-wizard-field product-wizard-field-wide">
        <MediaGalleryField value={product.galleryMediaIds} legacyUrls={product.gallery.map((item) => item.url)} onChange={(galleryMediaIds) => onChange({ galleryMediaIds })} />
      </div>
      <label className="product-wizard-checkbox">
        <input type="checkbox" checked={product.featured} onChange={(event) => onChange({ featured: event.target.checked })} />
        <span>Đưa vào nhóm nổi bật</span>
      </label>
    </div>
    <div className="product-wizard-subsection">
      <h4>SEO cơ bản</h4>
      <div className="product-wizard-form-grid">
        <label className="product-wizard-field"><span>SEO title</span><input value={product.seoTitle} onChange={(event) => onChange({ seoTitle: event.target.value })} /></label>
        <label className="product-wizard-field"><span>SEO keywords</span><input value={product.seoKeywords} onChange={(event) => onChange({ seoKeywords: event.target.value })} /></label>
        <label className="product-wizard-field product-wizard-field-wide"><span>SEO description</span><textarea rows={2} value={product.seoDescription} onChange={(event) => onChange({ seoDescription: event.target.value })} /></label>
      </div>
    </div>
    <div className="product-wizard-subsection">
      <h4>Nội dung public theo sản phẩm</h4>
      <div className="product-wizard-form-grid">
        <label className="product-wizard-field"><span>Nhãn mạng</span><input value={product.networkLabel} onChange={(event) => onChange({ networkLabel: event.target.value })} /></label>
        <label className="product-wizard-field"><span>Nhãn tốc độ</span><input value={product.speedLabel} onChange={(event) => onChange({ speedLabel: event.target.value })} /></label>
        <label className="product-wizard-field product-wizard-field-wide"><span>Hướng dẫn cài đặt public</span><textarea rows={2} value={product.installationGuide} onChange={(event) => onChange({ installationGuide: event.target.value })} /></label>
        <label className="product-wizard-field product-wizard-field-wide"><span>Tương thích</span><textarea rows={2} value={product.compatibilityContent} onChange={(event) => onChange({ compatibilityContent: event.target.value })} /></label>
        <label className="product-wizard-field"><span>Trong hộp</span><input value={product.packageContents} onChange={(event) => onChange({ packageContents: event.target.value })} /></label>
        <label className="product-wizard-field"><span>Ghi chú giao hàng</span><input value={product.deliveryNote} onChange={(event) => onChange({ deliveryNote: event.target.value })} /></label>
        <label className="product-wizard-field"><span>Điều kiện đủ dùng</span><input value={product.eligibilityNote} onChange={(event) => onChange({ eligibilityNote: event.target.value })} /></label>
        <label className="product-wizard-field"><span>Kích thước SIM</span><input value={product.simSize} onChange={(event) => onChange({ simSize: event.target.value })} /></label>
      </div>
    </div>
    {product.operation === 'device_sale' && <div className="product-wizard-subsection">
      <h4>Thông số thiết bị canonical</h4>
      <div className="product-wizard-form-grid">
        <label className="product-wizard-field"><span>Thương hiệu</span><input value={product.deviceSpecifications?.brand ?? ''} onChange={(event) => updateDeviceSpecification('brand', event.target.value)} /></label>
        <label className="product-wizard-field"><span>Model</span><input value={product.deviceSpecifications?.model ?? ''} onChange={(event) => updateDeviceSpecification('model', event.target.value)} /></label>
        <label className="product-wizard-field"><span>Thế hệ mạng</span><input value={product.deviceSpecifications?.networkGeneration ?? ''} onChange={(event) => updateDeviceSpecification('networkGeneration', event.target.value)} /></label>
        <label className="product-wizard-field"><span>Wi-Fi</span><input value={product.deviceSpecifications?.wifiStandard ?? ''} onChange={(event) => updateDeviceSpecification('wifiStandard', event.target.value)} /></label>
        <label className="product-wizard-field"><span>Băng tần</span><input value={product.deviceSpecifications?.supportedBands?.join(', ') ?? ''} onChange={(event) => updateDeviceSpecification('supportedBands', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} /></label>
        <label className="product-wizard-field"><span>Pin</span><input value={product.deviceSpecifications?.batteryCapacity ?? ''} onChange={(event) => updateDeviceSpecification('batteryCapacity', event.target.value)} /></label>
        <label className="product-wizard-field"><span>Bảo hành</span><input type="number" min="0" value={product.deviceSpecifications?.warrantyMonths ?? ''} onChange={(event) => updateDeviceSpecification('warrantyMonths', event.target.value ? Math.max(0, Number(event.target.value)) : undefined)} /></label>
      </div>
    </div>}
  </section>
  );
};

export default ProductGeneralStep;
