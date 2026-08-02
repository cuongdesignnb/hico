import { X } from 'lucide-react';
import type { ReconciliationItem } from '../../../types/reconciliation';
import {
  RECONCILIATION_RESOLUTION_LABELS,
  RECONCILIATION_STATUS_LABELS,
} from './reconciliationLabels';

interface ReconciliationDetailsDrawerProps {
  item: ReconciliationItem;
  onClose: () => void;
}

const ReconciliationDetailsDrawer = ({
  item,
  onClose,
}: ReconciliationDetailsDrawerProps) => (
  <div className="provider-dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <aside
      className="provider-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconciliation-details-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header>
        <div>
          <span>Reconciliation</span>
          <h3 id="reconciliation-details-title">{item.productName}</h3>
        </div>
        <button
          type="button"
          className="provider-icon-button"
          onClick={onClose}
          aria-label="Đóng chi tiết reconciliation"
          title="Đóng"
        >
          <X size={17} />
        </button>
      </header>

      <section className="provider-dialog-section">
        <h4>Kết quả đối chiếu</h4>
        <dl>
          <div><dt>Trạng thái</dt><dd>{RECONCILIATION_STATUS_LABELS[item.status]}</dd></div>
          <div><dt>Lý do</dt><dd>{item.reason}</dd></div>
          <div>
            <dt>Gợi ý</dt>
            <dd>
              {item.suggestedResolution
                ? RECONCILIATION_RESOLUTION_LABELS[item.suggestedResolution]
                : 'Chưa có gợi ý an toàn'}
            </dd>
          </div>
          <div>
            <dt>Admin xác nhận</dt>
            <dd>
              {item.confirmedResolution
                ? RECONCILIATION_RESOLUTION_LABELS[item.confirmedResolution]
                : 'Chưa xác nhận'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="provider-dialog-section">
        <h4>Variant catalog</h4>
        <dl>
          <div><dt>Product ID</dt><dd><code>{item.productId}</code></dd></div>
          <div><dt>Variant ID</dt><dd><code>{item.variantId}</code></dd></div>
          <div><dt>SKU</dt><dd><code>{item.sku}</code></dd></div>
          <div><dt>wmproductId</dt><dd><code>{item.wmproductId ?? 'Chưa có'}</code></dd></div>
          <div><dt>Người duyệt</dt><dd>{item.reviewedBy ?? 'Chưa duyệt'}</dd></div>
        </dl>
      </section>

      <section className="provider-dialog-section">
        <h4>Offer Worldmove cùng wmproductId</h4>
        {item.providerOffers.length > 0 ? (
          <div className="reconciliation-offer-list">
            {item.providerOffers.map((offer) => (
              <div key={offer.id}>
                <strong>{offer.providerProductName}</strong>
                <span>{offer.id}</span>
                <span>{offer.active ? 'Đang hoạt động' : 'Ngừng cung cấp'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="reconciliation-muted">Không có offer exact-match.</p>
        )}
      </section>
    </aside>
  </div>
);

export default ReconciliationDetailsDrawer;
