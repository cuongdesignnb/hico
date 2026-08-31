import { Check } from 'lucide-react';

interface DataSelectorProps {
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  stepNumber?: number;
}

const labelForLimit = (limit: string): string => {
  const lower = limit.toLowerCase();
  if (lower.includes('/')) return limit;
  if (lower.includes('unlimited')) return 'unlimited';
  return `${limit} tổng`;
};

export const DataSelector = ({ options, selected, onSelect, stepNumber = 2 }: DataSelectorProps) => {
  if (options.length === 0) return null;

  return (
    <div className="pdp-selector pdp-selector--data">
      <div className="pdp-selector-header">
        <h3 className="pdp-selector-title">{stepNumber}. Chọn dung lượng</h3>
        <span className="pdp-selector-hint">Dung lượng có trong sản phẩm</span>
      </div>
      <div className="pdp-data-grid">
        {options.map((option) => {
          const isSelected = option === selected;
          return (
            <button
              type="button"
              key={option}
              className={`pdp-data-chip${isSelected ? ' is-selected' : ''}`}
              onClick={() => onSelect(option)}
              aria-pressed={isSelected}
            >
              <span className="pdp-data-chip-label">{option}</span>
              <span className="pdp-data-chip-meta">{labelForLimit(option)}</span>
              {isSelected && (
                <span className="pdp-data-chip-check" aria-hidden="true">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DataSelector;