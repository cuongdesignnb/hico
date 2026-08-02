interface BulkPriceFormProps {
  operation: 'ADJUST_PRICE' | 'SET_PRICE' | 'SET_COMPARE_PRICE' | 'CLEAR_COMPARE_PRICE';
  mode: 'percent' | 'fixed';
  value: string;
  currency: 'VND' | 'USD';
  onModeChange: (mode: 'percent' | 'fixed') => void;
  onValueChange: (value: string) => void;
  onCurrencyChange: (value: 'VND' | 'USD') => void;
}

const BulkPriceForm = ({ operation, mode, value, currency, onModeChange, onValueChange, onCurrencyChange }: BulkPriceFormProps) => (
  <div className="catalog-bulk-form-grid">
    {operation === 'ADJUST_PRICE' && (
      <label><span>Kiểu điều chỉnh</span><select value={mode} onChange={(event) => onModeChange(event.target.value as 'percent' | 'fixed')}><option value="percent">Theo phần trăm</option><option value="fixed">Theo số tiền</option></select></label>
    )}
    {operation !== 'CLEAR_COMPARE_PRICE' && <label><span>{operation === 'ADJUST_PRICE' ? 'Mức điều chỉnh' : operation === 'SET_COMPARE_PRICE' ? 'Giá niêm yết' : 'Giá bán'}</span><input type="number" min="0" step="any" value={value} onChange={(event) => onValueChange(event.target.value)} /></label>}
    <label><span>Đơn vị tiền</span><select value={currency} onChange={(event) => onCurrencyChange(event.target.value as 'VND' | 'USD')}><option value="VND">VND</option><option value="USD">USD</option></select></label>
  </div>
);

export default BulkPriceForm;
