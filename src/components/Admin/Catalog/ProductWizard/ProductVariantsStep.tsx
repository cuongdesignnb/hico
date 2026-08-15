import { Plus, Rows3 } from 'lucide-react';
import { useState } from 'react';
import type { CatalogCategoryKind, ProductOperation } from '../../../../types/catalog';
import type { ProviderOffer } from '../../../../types/provider';
import type { VariantDraft, WizardSourceMode } from '../../../../types/productWizard';
import VariantTable from './VariantTable';
import { getCompatibleSources, offerMatchesSource, sourceLabels } from './productWizardLabels';

interface ProductVariantsStepProps {
  variants: VariantDraft[];
  operation: ProductOperation;
  categoryKind?: CatalogCategoryKind | null;
  offers: ProviderOffer[];
  offersLoading: boolean;
  onAdd: () => void;
  onAddProviderOffers: (offers: ProviderOffer[]) => void;
  onApplySource: (sourceMode: WizardSourceMode) => void;
  onUpdate: (tempId: string, changes: Partial<VariantDraft>) => void;
  onDuplicate: (tempId: string) => void;
  onRemove: (tempId: string) => void;
}

const ProductVariantsStep = ({ operation, categoryKind, variants, offers, offersLoading, onAdd, onAddProviderOffers, onApplySource, onUpdate, onDuplicate, onRemove }: ProductVariantsStepProps) => {
  const compatibleSources = getCompatibleSources(operation, categoryKind);
  const [bulkSource, setBulkSource] = useState<WizardSourceMode>(compatibleSources[0]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const providerSources = compatibleSources.filter((source) => ['worldmove_esim', 'local_esim', 'worldmove_physical', 'worldmove_topup'].includes(source));
  const providerOffers = offers.filter((offer) => offer.active && providerSources.some((source) => offerMatchesSource(offer, source)));
  const appliedSource = compatibleSources.includes(bulkSource) ? bulkSource : compatibleSources[0];
  const toggleOffer = (offerId: string) => setSelectedOffers((current) => current.includes(offerId) ? current.filter((id) => id !== offerId) : [...current, offerId]);
  const addSelectedOffers = () => { onAddProviderOffers(providerOffers.filter((offer) => selectedOffers.includes(offer.id))); setSelectedOffers([]); };
  return <section className="product-wizard-step-content">
    <div className="product-wizard-section-heading product-wizard-section-heading-with-action">
      <div><span className="product-wizard-kicker">Bước 3</span><h3>Biến thể & nguồn cấp</h3><p>Mỗi dòng là một gói bán. Giá bán nhập bằng VND; mã provider chỉ được chọn exact từ snapshot.</p></div>
      <button type="button" className="product-wizard-secondary-button" onClick={onAdd}><Plus size={16} /> Thêm dòng</button>
    </div>
    <div className="product-wizard-variant-tools"><label><span>Áp dụng nguồn cho tất cả</span><select value={appliedSource} onChange={(event) => setBulkSource(event.target.value as WizardSourceMode)}>{compatibleSources.map((source) => <option value={source} key={source}>{sourceLabels[source]}</option>)}</select></label><button type="button" className="product-wizard-secondary-button" disabled={variants.length === 0} onClick={() => onApplySource(appliedSource)}><Rows3 size={15} /> Áp dụng</button></div>
    {providerSources.length > 0 && <details className="product-wizard-provider-multi"><summary>Thêm nhiều gói từ Provider Offers</summary>{offersLoading ? <p className="product-wizard-muted">Đang tải Provider Offers...</p> : <><div className="product-wizard-provider-multi-list">{providerOffers.map((offer) => <label key={offer.id}><input type="checkbox" checked={selectedOffers.includes(offer.id)} onChange={() => toggleOffer(offer.id)} /><span><strong>{offer.wmproductId}</strong>{offer.providerProductName}</span><small>{offer.productRegion} · {offer.providerCost.toLocaleString('vi-VN')} {offer.providerCurrency}</small></label>)}</div><button type="button" className="product-wizard-primary-button" disabled={selectedOffers.length === 0} onClick={addSelectedOffers}>Thêm {selectedOffers.length} offer đã chọn</button></>}
    </details>}
    {variants.length === 0 ? (
      <div className="product-wizard-empty"><strong>Chưa có variant</strong><span>Thêm thủ công hoặc chọn nhiều Provider Offers để tiếp tục.</span><button type="button" className="product-wizard-primary-button" onClick={onAdd}><Plus size={16} /> Thêm variant</button></div>
    ) : <VariantTable variants={variants} operation={operation} categoryKind={categoryKind} offers={offers} offersLoading={offersLoading} onUpdate={onUpdate} onDuplicate={onDuplicate} onRemove={onRemove} />}
  </section>;
};

export default ProductVariantsStep;
