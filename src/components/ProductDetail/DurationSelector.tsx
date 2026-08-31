import { Check } from 'lucide-react';

interface DurationSelectorProps {
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  isCompatible: (value: string) => boolean;
  stepNumber?: number;
}

export const DurationSelector = ({
  options,
  selected,
  onSelect,
  isCompatible,
  stepNumber = 3,
}: DurationSelectorProps) => {
  if (options.length === 0) return null;

  return (
    <div className="pdp-selector pdp-selector--duration">
      <div className="pdp-selector-header">
        <h3 className="pdp-selector-title">{stepNumber}. Chọn số ngày sử dụng</h3>
      </div>
      <div className="pdp-duration-grid">
        {options.map((option) => {
          const isSelected = option === selected;
          const compatible = isCompatible(option);
          return (
            <button
              type="button"
              key={option}
              className={`pdp-duration-chip${isSelected ? ' is-selected' : ''}${compatible ? '' : ' is-disabled'}`}
              onClick={() => compatible && onSelect(option)}
              disabled={!compatible}
              aria-pressed={isSelected}
            >
              <span className="pdp-duration-label">{option}</span>
              {isSelected && (
                <span className="pdp-duration-check" aria-hidden="true">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="pdp-selector-footnote">
        Thời gian tính từ khi quét mã và kết nối vào mạng tại quốc gia đã chọn.
      </p>
    </div>
  );
};

export default DurationSelector;