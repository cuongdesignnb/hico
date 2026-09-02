import type { CatalogProductRecord } from '../../../types/catalog';

interface ProductSeoPreviewProps {
  product: CatalogProductRecord;
}

// Strip HTML tags for preview
const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, '').trim();

const ProductSeoPreview = ({ product }: ProductSeoPreviewProps) => {
  const seoTitle = product.seoTitle?.trim() || product.name;
  const rawDescription = product.seoDescription?.trim() || stripHtml(product.description || '').slice(0, 160);
  const seoKeywords = product.seoKeywords?.trim() || '';

  return (
    <div className="catalog-preview-seo">
      <div className="catalog-preview-seo__row">
        <span>Slug</span>
        <strong className="catalog-mono">{product.slug}</strong>
      </div>
      <div className="catalog-preview-seo__row">
        <span>SEO title</span>
        <strong>{seoTitle || <em className="catalog-preview-seo__empty">Chưa cấu hình</em>}</strong>
      </div>
      <div className="catalog-preview-seo__row">
        <span>SEO description</span>
        <strong>{rawDescription || <em className="catalog-preview-seo__empty">Chưa cấu hình</em>}</strong>
      </div>
      <div className="catalog-preview-seo__row">
        <span>SEO keywords</span>
        <strong>{seoKeywords || <em className="catalog-preview-seo__empty">Chưa cấu hình</em>}</strong>
      </div>

      <div className="catalog-preview-seo__serp" aria-label="Xem trước kết quả tìm kiếm">
        <span className="catalog-preview-seo__serp-label">Xem trước Google</span>
        <div className="catalog-preview-seo__serp-card">
          <span className="catalog-preview-seo__serp-url">
            hico.vn/san-pham/{product.slug}
          </span>
          <strong className="catalog-preview-seo__serp-title">{seoTitle}</strong>
          <p className="catalog-preview-seo__serp-desc">
            {rawDescription || 'Mô tả SEO sẽ hiển thị tại đây khi được cấu hình.'}
          </p>
        </div>
      </div>

      <div className="catalog-preview-seo__hint">
        Cập nhật SEO trong Product Wizard.
      </div>
    </div>
  );
};

export default ProductSeoPreview;