import { Eye } from 'lucide-react';
import type { ProviderOffer } from '../../../types/provider';
import {
  formatProviderDate,
  formatTwd,
  getProviderOfferTypeLabel,
} from './providerLabels';

interface WorldmoveOfferTableProps {
  offers: ProviderOffer[];
  onSelectOffer: (offer: ProviderOffer) => void;
}

const WorldmoveOfferTable = ({
  offers,
  onSelectOffer,
}: WorldmoveOfferTableProps) => (
  <div className="provider-table-scroll">
    <table className="provider-table">
      <thead>
        <tr>
          <th>Offer</th>
          <th>Loại</th>
          <th>Vùng phủ</th>
          <th>Giá vốn</th>
          <th>wmproductId</th>
          <th>Liên kết</th>
          <th>Trạng thái</th>
          <th>Lần đồng bộ</th>
          <th aria-label="Thao tác" />
        </tr>
      </thead>
      <tbody>
        {offers.map((offer) => (
          <tr key={offer.id}>
            <td>
              <div className="provider-offer-name">
                <strong>{offer.providerProductName}</strong>
                <span>{offer.providerProductId || 'Không có providerProductId'}</span>
              </div>
            </td>
            <td>
              <span className={`provider-type provider-type-${offer.providerProductType}`}>
                {getProviderOfferTypeLabel(offer)}
              </span>
            </td>
            <td>{offer.productRegion}</td>
            <td className="provider-cost">{formatTwd(offer.providerCost)}</td>
            <td><code className="provider-product-id">{offer.wmproductId}</code></td>
            <td><span className="provider-link-status">Chưa liên kết</span></td>
            <td>
              <span className={`provider-status provider-status-${offer.active ? 'active' : 'inactive'}`}>
                {offer.active ? 'Đang hoạt động' : 'Ngừng cung cấp'}
              </span>
            </td>
            <td className="provider-sync-date">{formatProviderDate(offer.syncedAt)}</td>
            <td>
              <button
                type="button"
                className="provider-icon-button"
                onClick={() => onSelectOffer(offer)}
                aria-label={`Xem chi tiết ${offer.providerProductName}`}
                title="Xem chi tiết"
              >
                <Eye size={16} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default WorldmoveOfferTable;
