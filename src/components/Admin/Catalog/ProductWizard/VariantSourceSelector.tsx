import type { CatalogCategoryKind, ProductOperation } from '../../../../types/catalog';
import type { ProviderOffer } from '../../../../types/provider';
import type { VariantDraft, WizardSourceMode } from '../../../../types/productWizard';
import { getCompatibleSources, sourceDescriptions, sourceLabels } from './productWizardLabels';
import ProviderOfferPicker from './ProviderOfferPicker';

interface VariantSourceSelectorProps {
  operation: ProductOperation;
  categoryKind?: CatalogCategoryKind | null;
  variant: VariantDraft;
  offers: ProviderOffer[];
  offersLoading: boolean;
  hideModeChoices?: boolean;
  onChange: (changes: Partial<VariantDraft>) => void;
}

const VariantSourceSelector = ({ operation, categoryKind, variant, offers, offersLoading, hideModeChoices = false, onChange }: VariantSourceSelectorProps) => {
  const sourceModes = getCompatibleSources(operation, categoryKind);
  const setSource = (sourceMode: WizardSourceMode) => onChange({ sourceMode, providerOfferId: undefined, wmproductId: undefined, providerProductType: undefined, leSIM: undefined });
  const needsOffer = variant.sourceMode === 'worldmove_esim';

  return (
    <div className="product-wizard-source-selector">
      {!hideModeChoices && <div className="product-wizard-source-grid">
        {sourceModes.map((sourceMode) => (
          <label className={`product-wizard-source-option ${variant.sourceMode === sourceMode ? 'is-selected' : ''}`} key={sourceMode}>
            <input type="radio" name={`source-${variant.tempId}`} checked={variant.sourceMode === sourceMode} onChange={() => setSource(sourceMode)} />
            <span><strong>{sourceLabels[sourceMode]}</strong><small>{sourceDescriptions[sourceMode]}</small></span>
          </label>
        ))}
      </div>}
      {variant.sourceMode === 'hico_physical' && <label className="product-wizard-field product-wizard-stock-field"><span>Tồn kho <b>*</b></span><input type="number" min="0" step="1" value={variant.stock} onChange={(event) => onChange({ stock: event.target.value })} placeholder="0" /></label>}
      {variant.sourceMode === 'manual_processing' && <div className="product-wizard-alert product-wizard-alert-warning">Variant này sẽ giữ inactive, cần review và không publishable.</div>}
      {needsOffer && variant.sourceMode && <ProviderOfferPicker sourceMode={variant.sourceMode} offers={offers} loading={offersLoading} selectedOfferId={variant.providerOfferId} onSelect={(offer) => onChange({ providerOfferId: offer.id, wmproductId: offer.wmproductId, providerProductId: offer.providerProductId, providerProductType: offer.providerProductType, leSIM: offer.leSIM })} />}
    </div>
  );
};

export default VariantSourceSelector;
