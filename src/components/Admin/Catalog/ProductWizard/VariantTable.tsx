import { Copy, Trash2 } from 'lucide-react';
import { Fragment } from 'react';
import type { VariantDraft } from '../../../../types/productWizard';
import type { CatalogCategoryKind, ProductOperation } from '../../../../types/catalog';
import type { ProviderOffer } from '../../../../types/provider';
import type { WizardSourceMode } from '../../../../types/productWizard';
import { getCompatibleSources, sourceLabels } from './productWizardLabels';
import VariantSourceSelector from './VariantSourceSelector';

interface VariantTableProps {
  variants: VariantDraft[];
  operation: ProductOperation;
  categoryKind?: CatalogCategoryKind | null;
  offers: ProviderOffer[];
  offersLoading: boolean;
  onUpdate: (tempId: string, changes: Partial<VariantDraft>) => void;
  onDuplicate: (tempId: string) => void;
  onRemove: (tempId: string) => void;
}

const VariantTable = ({ variants, operation, categoryKind, offers, offersLoading, onUpdate, onDuplicate, onRemove }: VariantTableProps) => {
  const sourceModes = getCompatibleSources(operation, categoryKind);
  const setSource = (tempId: string, sourceMode: WizardSourceMode | undefined) => onUpdate(tempId, {
    sourceMode,
    providerOfferId: undefined,
    wmproductId: undefined,
    providerProductId: undefined,
    providerProductType: undefined,
    leSIM: undefined,
  });
  return <div className="product-wizard-variant-table-wrap">
    <table className="product-wizard-variant-table">
      <thead><tr><th>SKU / WMID</th><th>Dung lượng</th><th>Thời hạn</th><th>Giá bán VND</th><th>Giá so sánh</th><th>Nguồn cấp</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
      <tbody>{variants.map((variant, index) => <Fragment key={variant.tempId}>
        <tr>
          <td><input aria-label={`SKU gói ${index + 1}`} value={variant.sku} onChange={(event) => onUpdate(variant.tempId, { sku: event.target.value })} placeholder="SKU / WMID" /></td>
          <td><input aria-label={`Dung lượng gói ${index + 1}`} value={variant.dataLimit} onChange={(event) => onUpdate(variant.tempId, { dataLimit: event.target.value })} placeholder="10GB" /></td>
          <td><input aria-label={`Thời hạn gói ${index + 1}`} value={variant.duration} onChange={(event) => onUpdate(variant.tempId, { duration: event.target.value })} placeholder="30 ngày" /></td>
          <td><input aria-label={`Giá bán gói ${index + 1}`} type="number" min="0" value={variant.price} onChange={(event) => onUpdate(variant.tempId, { price: event.target.value, currency: 'VND' })} /></td>
          <td><input aria-label={`Giá so sánh gói ${index + 1}`} type="number" min="0" value={variant.compareAtPrice} onChange={(event) => onUpdate(variant.tempId, { compareAtPrice: event.target.value })} /></td>
          <td><select aria-label={`Nguồn cấp gói ${index + 1}`} value={variant.sourceMode ?? ''} onChange={(event) => setSource(variant.tempId, event.target.value ? event.target.value as WizardSourceMode : undefined)}><option value="">Chọn nguồn</option>{sourceModes.map((sourceMode) => <option value={sourceMode} key={sourceMode}>{sourceLabels[sourceMode]}</option>)}</select></td>
          <td><span className={`product-wizard-status-chip ${variant.active ? 'is-active' : ''}`}>{variant.active ? 'Đang bán' : 'Inactive'}</span></td>
          <td><div className="product-wizard-row-actions"><button type="button" className="product-wizard-icon-button" onClick={() => onDuplicate(variant.tempId)} aria-label={`Nhân bản gói ${index + 1}`} title="Nhân bản"><Copy size={15} /></button>{!variant.id && <button type="button" className="product-wizard-icon-button product-wizard-icon-button-danger" onClick={() => onRemove(variant.tempId)} aria-label={`Xóa gói ${index + 1}`} title="Xóa"><Trash2 size={15} /></button>}</div></td>
        </tr>
        {variant.sourceMode && <tr className="product-wizard-variant-source-row"><td colSpan={8}><details open={!variant.providerOfferId && variant.sourceMode === 'worldmove_esim'}><summary>Cấu hình nguồn · {sourceLabels[variant.sourceMode]}</summary><VariantSourceSelector operation={operation} categoryKind={categoryKind} variant={variant} offers={offers} offersLoading={offersLoading} hideModeChoices onChange={(changes) => onUpdate(variant.tempId, changes)} /></details></td></tr>}
      </Fragment>)}</tbody>
    </table>
  </div>;
};

export default VariantTable;
