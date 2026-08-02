import type { ProductDraft } from '../../../../types/productWizard';

interface ProductGeneralStepProps {
  product: ProductDraft;
  onChange: (changes: Partial<ProductDraft>) => void;
  onGenerateSlug: () => void;
}

const ProductGeneralStep = ({ product, onChange, onGenerateSlug }: ProductGeneralStepProps) => (
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
      <label className="product-wizard-field">
        <span>Ảnh đại diện</span>
        <input value={product.image} onChange={(event) => onChange({ image: event.target.value })} placeholder="https://..." />
      </label>
      <label className="product-wizard-field product-wizard-field-wide">
        <span>Mô tả</span>
        <textarea rows={3} value={product.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Mô tả ngắn cho Admin và khách hàng." />
      </label>
      <label className="product-wizard-field product-wizard-field-wide">
        <span>Hướng dẫn sử dụng</span>
        <textarea rows={3} value={product.guide} onChange={(event) => onChange({ guide: event.target.value })} placeholder="Các bước kích hoạt hoặc lưu ý." />
      </label>
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
  </section>
);

export default ProductGeneralStep;
