import { X } from 'lucide-react';

interface ProductWizardHeaderProps {
  mode: 'create' | 'edit';
  productName: string;
  onClose: () => void;
}

const ProductWizardHeader = ({ mode, productName, onClose }: ProductWizardHeaderProps) => (
  <header className="product-wizard-header">
    <div>
      <span className="product-wizard-eyebrow">Canonical Catalog</span>
      <h2>{mode === 'create' ? 'Tạo sản phẩm nháp' : 'Chỉnh sửa sản phẩm'}</h2>
      <p>{productName || 'Sản phẩm mới'} · Chưa publish</p>
    </div>
    <button type="button" className="product-wizard-icon-button" onClick={onClose} aria-label="Đóng wizard" title="Đóng">
      <X size={19} />
    </button>
  </header>
);

export default ProductWizardHeader;
