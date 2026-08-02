import { useEffect, useState } from 'react';
import { getWorldmoveOffers } from '../../../../services/providerApi';
import type { ProviderOffer } from '../../../../types/provider';

interface BulkProviderMappingFormProps {
  clear: boolean;
  value: string;
  onChange: (value: string) => void;
}

const BulkProviderMappingForm = ({ clear, value, onChange }: BulkProviderMappingFormProps) => {
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  useEffect(() => { if (!clear) void getWorldmoveOffers().then(setOffers).catch(() => setOffers([])); }, [clear]);
  if (clear) return <p className="catalog-bulk-form-note">Nguồn cấp sẽ được gỡ và mục chuyển sang trạng thái cần kiểm tra thủ công.</p>;
  return (
    <label><span>Nguồn cấp đã đồng bộ</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Chọn nguồn cấp</option>{offers.filter((offer) => offer.active).map((offer) => <option key={offer.id} value={offer.id}>{offer.providerProductName} · {offer.productRegion}</option>)}</select></label>
  );
};

export default BulkProviderMappingForm;
