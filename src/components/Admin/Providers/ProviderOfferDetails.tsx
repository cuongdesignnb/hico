import { X } from 'lucide-react';
import type { ProviderOffer } from '../../../types/provider';
import {
  formatProviderDate,
  formatTwd,
  getProductTypeLabel,
  getProviderOfferTypeLabel,
} from './providerLabels';

interface ProviderOfferDetailsProps {
  offer: ProviderOffer;
  onClose: () => void;
}

const ProviderOfferDetails = ({
  offer,
  onClose,
}: ProviderOfferDetailsProps) => (
  <div className="provider-dialog-backdrop" role="presentation">
    <section
      className="provider-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-dialog-title"
    >
      <header>
        <div>
          <span>Worldmove</span>
          <h3 id="provider-dialog-title">{offer.providerProductName}</h3>
        </div>
        <button
          type="button"
          className="provider-icon-button"
          onClick={onClose}
          aria-label="Đóng chi tiết offer"
          title="Đóng"
        >
          <X size={18} />
        </button>
      </header>

      <div className="provider-dialog-section">
        <h4>Thông tin offer</h4>
        <dl>
          <div><dt>Phân loại</dt><dd>{getProviderOfferTypeLabel(offer)}</dd></div>
          <div><dt>Vùng phủ</dt><dd>{offer.productRegion}</dd></div>
          <div><dt>Giá vốn</dt><dd>{formatTwd(offer.providerCost)}</dd></div>
          <div>
            <dt>Giá C-end</dt>
            <dd>{offer.cEndPrice === null || offer.cEndPrice === undefined ? 'Không có' : formatTwd(offer.cEndPrice)}</dd>
          </div>
          <div><dt>Hiển thị C-end</dt><dd>{offer.cEndVisible ? 'Có' : 'Không'}</dd></div>
          <div><dt>Lần đồng bộ</dt><dd>{formatProviderDate(offer.syncedAt)}</dd></div>
        </dl>
      </div>

      <div className="provider-dialog-section">
        <h4>Chi tiết kỹ thuật</h4>
        <dl>
          <div><dt>Offer ID</dt><dd><code>{offer.id}</code></dd></div>
          <div><dt>wmproductId</dt><dd><code>{offer.wmproductId}</code></dd></div>
          <div>
            <dt>providerProductId</dt>
            <dd><code>{offer.providerProductId || 'Không có'}</code></dd>
          </div>
          <div>
            <dt>productType</dt>
            <dd>{offer.providerProductType} - {getProductTypeLabel(offer.providerProductType)}</dd>
          </div>
          <div>
            <dt>Nguồn eSIM</dt>
            <dd>
              {offer.providerProductType === 0
                ? offer.leSIM ? 'Worldmove' : 'Nhà mạng địa phương'
                : 'Không áp dụng'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  </div>
);

export default ProviderOfferDetails;
