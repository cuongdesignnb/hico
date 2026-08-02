import { Copy, Trash2 } from 'lucide-react';
import type { VariantDraft } from '../../../../types/productWizard';
import { getVariantSourceLabel } from './productWizardLabels';
import VariantEditor from './VariantEditor';

interface VariantTableProps {
  variants: VariantDraft[];
  onUpdate: (tempId: string, changes: Partial<VariantDraft>) => void;
  onDuplicate: (tempId: string) => void;
  onRemove: (tempId: string) => void;
}

const VariantTable = ({ variants, onUpdate, onDuplicate, onRemove }: VariantTableProps) => (
  <div className="product-wizard-variant-list">
    {variants.map((variant, index) => (
      <article className="product-wizard-variant-card" key={variant.tempId}>
        <div className="product-wizard-variant-card-header">
          <div><strong>Gói {index + 1}</strong><span>{variant.id ? `ID ${variant.id}` : 'Chưa lưu'}</span></div>
          <div className="product-wizard-row-actions">
            <span className={`product-wizard-status-chip ${variant.active ? 'is-active' : ''}`}>{variant.active ? 'Đang bán' : 'Nháp / inactive'}</span>
            <button type="button" className="product-wizard-icon-button" onClick={() => onDuplicate(variant.tempId)} aria-label={`Nhân bản gói ${index + 1}`} title="Nhân bản"><Copy size={15} /></button>
            {!variant.id && <button type="button" className="product-wizard-icon-button product-wizard-icon-button-danger" onClick={() => onRemove(variant.tempId)} aria-label={`Xóa gói ${index + 1}`} title="Xóa"><Trash2 size={15} /></button>}
          </div>
        </div>
        <VariantEditor variant={variant} onChange={(changes) => onUpdate(variant.tempId, changes)} />
        <div className="product-wizard-variant-meta">
          <span>Nguồn: {getVariantSourceLabel(variant)}</span>
          <span>{variant.needsReview ? 'Cần xác nhận nguồn' : 'Chưa kiểm tra readiness'}</span>
        </div>
      </article>
    ))}
  </div>
);

export default VariantTable;
