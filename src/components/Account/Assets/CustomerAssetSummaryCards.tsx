import { Cpu, CreditCard, Smartphone } from 'lucide-react';
import type { CustomerAssetSummary } from '../../../types/customerAsset';

const entries = [
  ['esims', 'eSIM', Smartphone, 'total'],
  ['physicalSims', 'SIM vật lý', CreditCard, 'total'],
  ['devices', 'Thiết bị', Cpu, 'total'],
] as const;

export const CustomerAssetSummaryCards = ({ summary }: { summary: CustomerAssetSummary }) => <section className="account-summary-grid account-asset-summary-grid" aria-label="Tài sản Customer">
  {entries.map(([key, label, Icon, countKey]) => {
    const group = summary[key];
    return <article className="account-summary-card" key={key}><Icon size={20} /><span>{label}</span><strong>{summary.available[key] ? group[countKey] : 'Chưa sẵn sàng'}</strong></article>;
  })}
</section>;
