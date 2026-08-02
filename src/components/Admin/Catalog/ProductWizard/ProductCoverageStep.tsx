import type { CoverageType } from '../../../../types/catalog';
import type { CoverageOption, ProductDraft } from '../../../../types/productWizard';

interface ProductCoverageStepProps {
  product: ProductDraft;
  options: CoverageOption[];
  loading: boolean;
  onChange: (changes: Partial<ProductDraft>) => void;
}

const coverageLabels: Record<CoverageType, string> = {
  country: 'Một quốc gia',
  region: 'Khu vực',
  global: 'Toàn cầu',
  not_applicable: 'Không áp dụng',
};

const ProductCoverageStep = ({ product, options, loading, onChange }: ProductCoverageStepProps) => {
  const toggleCoverage = (id: string) => {
    const selected = product.coverageIds.includes(id)
      ? product.coverageIds.filter((current) => current !== id)
      : [...product.coverageIds, id];
    onChange({ coverageIds: selected });
  };

  return (
    <section className="product-wizard-step-content">
      <div className="product-wizard-section-heading">
        <span className="product-wizard-kicker">Bước 2</span>
        <h3>Vùng phủ</h3>
        <p>Dùng coverage có cấu trúc từ danh sách điểm đến, không nhập chuỗi tự do.</p>
      </div>
      <div className="product-wizard-coverage-types">
        {(Object.keys(coverageLabels) as CoverageType[]).map((coverageType) => (
          <label className={`product-wizard-option product-wizard-option-compact ${product.coverageType === coverageType ? 'is-selected' : ''}`} key={coverageType}>
            <input type="radio" name="coverage-type" checked={product.coverageType === coverageType} onChange={() => onChange({ coverageType, coverageIds: coverageType === 'global' ? ['global'] : coverageType === 'not_applicable' ? [] : product.coverageIds.filter((id) => id !== 'global') })} />
            <strong>{coverageLabels[coverageType]}</strong>
          </label>
        ))}
      </div>
      {(product.coverageType === 'country' || product.coverageType === 'region') && (
        <div className="product-wizard-coverage-picker">
          <div className="product-wizard-subheading"><strong>{product.coverageType === 'country' ? 'Chọn quốc gia' : 'Chọn khu vực'}</strong><span>{product.coverageIds.length} đã chọn</span></div>
          {loading ? <p className="product-wizard-muted">Đang tải coverage...</p> : options.length === 0 ? <p className="product-wizard-muted">Chưa có coverage để chọn.</p> : (
            <div className="product-wizard-check-grid">
              {options.map((option) => (
                <label key={option.id} className="product-wizard-check-option">
                  <input type="checkbox" checked={product.coverageIds.includes(option.id)} onChange={() => toggleCoverage(option.id)} />
                  <span>{option.flag ? `${option.flag} ` : ''}{option.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ProductCoverageStep;
