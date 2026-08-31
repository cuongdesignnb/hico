import { Check } from 'lucide-react';
import type { SimTypeDescriptor } from '../../utils/productVariantGroups';

interface SimTypeSelectorProps {
  available: SimTypeDescriptor[];
  selected: SimTypeDescriptor['key'] | null;
  onSelect: (key: SimTypeDescriptor['key']) => void;
}

export const SimTypeSelector = ({ available, selected, onSelect }: SimTypeSelectorProps) => {
  if (available.length === 0) return null;

  return (
    <div className="pdp-selector pdp-selector--sim-type">
      <div className="pdp-selector-header">
        <h3 className="pdp-selector-title">1. Chọn loại SIM</h3>
        <span className="pdp-selector-hint">Loại SIM thực sự có trong sản phẩm này</span>
      </div>
      <div className="pdp-sim-type-grid">
        {available.map((descriptor) => {
          const isSelected = descriptor.key === selected;
          return (
            <button
              type="button"
              key={descriptor.key}
              className={`pdp-sim-type-card${isSelected ? ' is-selected' : ''}`}
              onClick={() => onSelect(descriptor.key)}
              aria-pressed={isSelected}
            >
              {isSelected && (
                <span className="pdp-sim-type-check" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <span className="pdp-sim-type-icon" aria-hidden="true">
                <SimIcon kind={descriptor.key} />
              </span>
              <span className="pdp-sim-type-label">{descriptor.label}</span>
              <span className="pdp-sim-type-desc">{descriptor.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SimIcon = ({ kind }: { kind: SimTypeDescriptor['key'] }): React.ReactElement => {
  switch (kind) {
    case 'esim_api':
      return <ChipIcon />;
    case 'lesim_auto':
      return <BoltIcon />;
    case 'esim_manual':
      return <MailIcon />;
    case 'physical_sim':
      return <CardIcon />;
  }
};

const ChipIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
  </svg>
);

const BoltIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const MailIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 8l9 6 9-6" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const CardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <line x1="4" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export default SimTypeSelector;
