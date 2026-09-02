import type { VariantDraft } from '../../../../types/productWizard';

interface VariantEditorProps {
  variant: VariantDraft;
  compact?: boolean;
  onChange: (changes: Partial<VariantDraft>) => void;
}

const HotspotSelect = ({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) => (
  <select
    value={value ?? ''}
    onChange={(e) => {
      if (e.target.value === '') onChange(undefined);
      else onChange(e.target.value);
    }}
  >
    <option value="">Chưa xác định</option>
    <option value="true">Có hỗ trợ</option>
    <option value="false">Không hỗ trợ</option>
  </select>
);

const VariantEditor = ({ variant, compact = false, onChange }: VariantEditorProps) => (
  <div className={`product-wizard-variant-editor ${compact ? 'is-compact' : ''}`}>
    <label className="product-wizard-field"><span>SKU <b>*</b></span><input value={variant.sku} onChange={(event) => onChange({ sku: event.target.value })} placeholder="JP-10GB-30D" /></label>
    <label className="product-wizard-field"><span>Dung lượng</span><input value={variant.dataLimit} onChange={(event) => onChange({ dataLimit: event.target.value })} placeholder="10GB" /></label>
    <label className="product-wizard-field"><span>Thời hạn</span><input value={variant.duration} onChange={(event) => onChange({ duration: event.target.value })} placeholder="30 ngày" /></label>
    <label className="product-wizard-field"><span>Giá bán <b>*</b></span><input type="number" min="0" value={variant.price} onChange={(event) => onChange({ price: event.target.value })} /></label>
    <label className="product-wizard-field"><span>Giá so sánh</span><input type="number" min="0" value={variant.compareAtPrice} onChange={(event) => onChange({ compareAtPrice: event.target.value })} /></label>
    <label className="product-wizard-field"><span>Tiền tệ</span><select value={variant.currency} onChange={(event) => onChange({ currency: event.target.value as VariantDraft['currency'] })}><option value="VND">VND</option><option value="USD">USD</option></select></label>
    {!compact && (
      <>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e5e7eb)', margin: '12px 0' }} />
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)', marginBottom: 8 }}>Kết nối &amp; sử dụng</div>
        <label className="product-wizard-field">
          <span>Mạng / nhà mạng</span>
          <input
            value={variant.networkLabel ?? ''}
            onChange={(event) => onChange({ networkLabel: event.target.value || undefined })}
            placeholder="VD: ETL 4G/LTE, Viettel, Mobifone..."
          />
        </label>
        <label className="product-wizard-field">
          <span>Chính sách kích hoạt</span>
          <input
            value={variant.activationPolicy ?? ''}
            onChange={(event) => onChange({ activationPolicy: event.target.value || undefined })}
            placeholder="VD: Tự động, Qua app, Cần liên hệ..."
          />
        </label>
        <label className="product-wizard-field">
          <span>Chia sẻ Hotspot</span>
          <HotspotSelect value={variant.hotspotSupport} onChange={(v) => onChange({ hotspotSupport: v })} />
        </label>
      </>
    )}
  </div>
);

export default VariantEditor;
