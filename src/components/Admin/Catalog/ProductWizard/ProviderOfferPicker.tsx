import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ProviderOffer } from '../../../../types/provider';
import type { WizardSourceMode } from '../../../../types/productWizard';
import { offerMatchesSource, sourceLabels } from './productWizardLabels';

interface ProviderOfferPickerProps {
  sourceMode: WizardSourceMode;
  offers: ProviderOffer[];
  loading: boolean;
  selectedOfferId?: string;
  onSelect: (offer: ProviderOffer) => void;
}

const ProviderOfferPicker = ({ sourceMode, offers, loading, selectedOfferId, onSelect }: ProviderOfferPickerProps) => {
  const [query, setQuery] = useState('');
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId);
  const matches = useMemo(() => offers.filter((offer) => {
    if (!offerMatchesSource(offer, sourceMode)) return false;
    if (!offer.active && offer.id !== selectedOfferId) return false;
    const text = `${offer.providerProductName} ${offer.productRegion} ${offer.wmproductId}`.toLocaleLowerCase();
    return text.includes(query.trim().toLocaleLowerCase());
  }), [offers, query, selectedOfferId, sourceMode]);

  return (
    <div className="product-wizard-offer-picker">
      <div className="product-wizard-subheading"><strong>Provider Offer · {sourceLabels[sourceMode]}</strong><span>{matches.length} phù hợp</span></div>
      {loading ? <p className="product-wizard-muted">Đang tải Provider Offers...</p> : (
        <>
          <label className="product-wizard-search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, vùng hoặc mã offer" /></label>
          {selectedOffer && !selectedOffer.active && <div className="product-wizard-alert product-wizard-alert-warning">Offer đang liên kết đã inactive. Hãy chọn offer active thay thế.</div>}
          {matches.length === 0 ? <p className="product-wizard-muted">Không có offer active phù hợp. Hãy đồng bộ Provider Catalog rồi thử lại.</p> : (
            <div className="product-wizard-offer-list">
              {matches.map((offer) => (
                <label className={`product-wizard-offer ${offer.id === selectedOfferId ? 'is-selected' : ''}`} key={offer.id}>
                  <input type="radio" name={`provider-offer-${sourceMode}`} checked={offer.id === selectedOfferId} onChange={() => onSelect(offer)} />
                  <span className="product-wizard-offer-main"><strong>{offer.providerProductName}</strong><small>{offer.productRegion} · {offer.leSIM === true ? 'leSIM' : offer.leSIM === false ? 'eSIM thường' : 'physical/top-up'} · {offer.providerCost.toLocaleString('vi-VN')} {offer.providerCurrency}</small></span>
                  <details className="product-wizard-offer-details"><summary>Chi tiết</summary><span>Offer: {offer.id}</span><span>wmproductId: {offer.wmproductId}</span><span>Product type: {offer.providerProductType}</span><span>Đồng bộ: {new Date(offer.syncedAt).toLocaleString('vi-VN')}</span></details>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProviderOfferPicker;
