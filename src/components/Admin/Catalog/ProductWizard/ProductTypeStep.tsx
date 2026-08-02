import type { ProductOperation } from '../../../../types/catalog';
import { operationLabels } from './productWizardLabels';

interface ProductTypeStepProps {
  value: ProductOperation;
  onChange: (value: ProductOperation) => void;
}

const ProductTypeStep = ({ value, onChange }: ProductTypeStepProps) => (
  <section className="product-wizard-step-content">
    <div className="product-wizard-section-heading">
      <span className="product-wizard-kicker">Bước 1</span>
      <h3>Chọn loại nghiệp vụ</h3>
      <p>Loại sản phẩm quyết định các nguồn cấp và quy tắc coverage có thể dùng.</p>
    </div>
    <div className="product-wizard-option-grid">
      {(Object.keys(operationLabels) as ProductOperation[]).map((operation) => (
        <label className={`product-wizard-option ${value === operation ? 'is-selected' : ''}`} key={operation}>
          <input type="radio" name="product-operation" value={operation} checked={value === operation} onChange={() => onChange(operation)} />
          <span>
            <strong>{operationLabels[operation]}</strong>
            <small>{operation === 'topup' ? 'Nạp thêm cho SIM hiện có.' : operation === 'device_sale' ? 'Thiết bị hoặc SIM vật lý.' : 'Gói thuê bao và eSIM du lịch.'}</small>
          </span>
        </label>
      ))}
    </div>
  </section>
);

export default ProductTypeStep;
