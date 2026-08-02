import { Cpu, CreditCard, Gauge, Smartphone } from 'lucide-react';
import type { CustomerAssetSummary } from '../../../types/customerAsset';

const entries = [
  ['esims', 'eSIM', Smartphone, 'total'],
  ['physicalSims', 'SIM vat ly', CreditCard, 'total'],
  ['devices', 'Thiet bi', Cpu, 'total'],
  ['topups', 'Nap them', Gauge, 'total'],
] as const;

export const CustomerAssetSummaryCards = ({ summary }: { summary: CustomerAssetSummary }) => <section className="account-summary-grid account-asset-summary-grid" aria-label="Tai san customer">
  {entries.map(([key, label, Icon, countKey]) => {
    const group = summary[key];
    return <article className="account-summary-card" key={key}><Icon size={20} /><span>{label}</span><strong>{summary.available[key] ? group[countKey] : 'Chua san sang'}</strong></article>;
  })}
</section>;
