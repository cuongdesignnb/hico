import { ArrowLeft, ArrowRight, Save } from 'lucide-react';

interface ProductWizardFooterProps {
  step: number;
  saving: boolean;
  dirty: boolean;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
}

const ProductWizardFooter = ({ step, saving, dirty, onBack, onNext, onSave }: ProductWizardFooterProps) => (
  <footer className="product-wizard-footer">
    <button type="button" className="product-wizard-secondary-button" onClick={onBack} disabled={step === 1 || saving}>
      <ArrowLeft size={16} /> Quay lại
    </button>
    <span className="product-wizard-save-state">{dirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ'}</span>
    {step < 5 ? (
      <button type="button" className="product-wizard-primary-button" onClick={onNext} disabled={saving}>
        Tiếp theo <ArrowRight size={16} />
      </button>
    ) : (
      <button type="button" className="product-wizard-primary-button" onClick={onSave} disabled={saving}>
        <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu bản nháp'}
      </button>
    )}
  </footer>
);

export default ProductWizardFooter;
