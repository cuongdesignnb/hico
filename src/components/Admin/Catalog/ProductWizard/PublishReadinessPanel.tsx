import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ProductReadinessResult } from '../../../../types/productWizard';

interface PublishReadinessPanelProps {
  readiness: ProductReadinessResult | null;
  loading: boolean;
  onCheck: () => void;
}

const PublishReadinessPanel = ({ readiness, loading, onCheck }: PublishReadinessPanelProps) => (
  <section className="product-wizard-readiness-panel">
    <div className="product-wizard-subheading"><strong>Publish readiness</strong><button type="button" className="product-wizard-inline-button" onClick={onCheck} disabled={loading}>{loading ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</button></div>
    {!readiness ? <p className="product-wizard-muted">Lưu draft trước để chạy kiểm tra từ backend.</p> : (
      <>
        <div className={`product-wizard-readiness-result ${readiness.publishable ? 'is-ready' : 'is-blocked'}`}>
          {readiness.publishable ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <strong>{readiness.publishable ? 'Sẵn sàng publish' : 'Chưa publishable'}</strong>
        </div>
        {readiness.errors.map((item, index) => <div className="product-wizard-readiness-item is-error" key={`error-${item.code || index}`}><AlertCircle size={15} /><span>{item.message}</span></div>)}
        {readiness.warnings.map((item, index) => <div className="product-wizard-readiness-item is-warning" key={`warning-${item.code || index}`}><Info size={15} /><span>{item.message}</span></div>)}
      </>
    )}
  </section>
);

export default PublishReadinessPanel;
