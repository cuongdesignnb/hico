import { AlertTriangle, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  ReconciliationItem,
  ReconciliationResolution,
  ReconciliationUpdateRequest,
} from '../../../types/reconciliation';
import {
  RECONCILIATION_RESOLUTION_LABELS,
  RECONCILIATION_STATUS_LABELS,
} from './reconciliationLabels';

interface ReconciliationConfirmDialogProps {
  item: ReconciliationItem;
  saving: boolean;
  onClose: () => void;
  onConfirm: (request: ReconciliationUpdateRequest) => void;
}

const resolutionForOffer = (
  providerProductType: 0 | 1 | 2,
  leSIM?: boolean | null,
): ReconciliationResolution | undefined => {
  if (providerProductType === 0 && leSIM === true) {
    return 'WORLDMOVE_ESIM_REDEEM';
  }
  if (providerProductType === 0 && leSIM === false) {
    return 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM';
  }
  if (providerProductType === 1) return 'WORLDMOVE_PHYSICAL_ORDER';
  if (providerProductType === 2) return 'WORLDMOVE_TOPUP';
  return undefined;
};

const ReconciliationConfirmDialog = ({
  item,
  saving,
  onClose,
  onConfirm,
}: ReconciliationConfirmDialogProps) => {
  const availableResolutions = useMemo(() => {
    const values = new Set<ReconciliationResolution>(['MANUAL_PROCESSING']);
    if (item.confirmedResolution) values.add(item.confirmedResolution);
    if (item.suggestedResolution) values.add(item.suggestedResolution);
    for (const offer of item.providerOffers) {
      const resolution = resolutionForOffer(
        offer.providerProductType,
        offer.leSIM,
      );
      if (resolution) values.add(resolution);
    }
    if (item.variantMedium === 'esim') values.add('HICO_MANUAL_QR');
    if (item.variantMedium === 'physical_sim') values.add('HICO_PHYSICAL_STOCK');
    return [...values];
  }, [
    item.confirmedResolution,
    item.providerOffers,
    item.suggestedResolution,
    item.variantMedium,
  ]);
  const defaultResolution = (
    item.confirmedResolution
    ?? item.suggestedResolution
    ?? availableResolutions[0]
  );
  const [resolution, setResolution] = useState<ReconciliationResolution>(
    defaultResolution,
  );
  const [providerOfferId, setProviderOfferId] = useState(
    item.providerOfferId
    ?? (item.providerOffers.length === 1 ? item.providerOffers[0].id : ''),
  );
  const usesWorldmove = resolution.startsWith('WORLDMOVE_');

  return (
    <div className="reconciliation-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="reconciliation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconciliation-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Xác nhận resolution</span>
            <h3 id="reconciliation-confirm-title">{item.productName}</h3>
          </div>
          <button
            type="button"
            className="provider-icon-button"
            onClick={onClose}
            aria-label="Đóng hộp thoại xác nhận"
            title="Đóng"
          >
            <X size={17} />
          </button>
        </header>

        <div className="reconciliation-confirm-preview">
          <dl>
            <div><dt>Variant</dt><dd>{item.sku}</dd></div>
            <div><dt>wmproductId</dt><dd><code>{item.wmproductId ?? 'Chưa có'}</code></dd></div>
            <div><dt>Kết quả</dt><dd>{RECONCILIATION_STATUS_LABELS[item.status]}</dd></div>
          </dl>
          {item.status !== 'MATCHED' && (
            <div className="reconciliation-warning">
              <AlertTriangle size={17} />
              <span>{item.reason}</span>
            </div>
          )}
          <p>
            Xác nhận này chỉ lưu kết quả reconciliation, chưa thay đổi checkout
            hoặc fulfillment.
          </p>
        </div>

        <div className="reconciliation-confirm-fields">
          <label>
            <span>Phương án xử lý</span>
            <select
              value={resolution}
              onChange={(event) => setResolution(
                event.target.value as ReconciliationResolution,
              )}
            >
              {availableResolutions.map((value) => (
                <option key={value} value={value}>
                  {RECONCILIATION_RESOLUTION_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          {usesWorldmove && (
            <label>
              <span>Chọn offer Worldmove</span>
              <select
                value={providerOfferId}
                onChange={(event) => setProviderOfferId(event.target.value)}
              >
                <option value="">Chọn offer</option>
                {item.providerOffers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.providerProductName}
                    {offer.active ? '' : ' - ngừng cung cấp'}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <footer>
          <button
            type="button"
            className="reconciliation-secondary-button"
            disabled={saving}
            onClick={() => onConfirm({ action: 'IGNORE' })}
          >
            Bỏ qua tạm thời
          </button>
          <button
            type="button"
            className="reconciliation-primary-button"
            disabled={saving || (usesWorldmove && !providerOfferId)}
            onClick={() => onConfirm({
              resolution,
              ...(usesWorldmove ? { providerOfferId } : {}),
            })}
          >
            {saving ? 'Đang lưu...' : (
              usesWorldmove
                ? 'Xác nhận dùng Worldmove'
                : RECONCILIATION_RESOLUTION_LABELS[resolution]
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ReconciliationConfirmDialog;
