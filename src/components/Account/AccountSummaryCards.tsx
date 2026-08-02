import { ClipboardList, Clock3, CircleCheck, WalletCards } from 'lucide-react';
import type { CustomerDashboardSummary } from '../../types/customerDashboard';

export const AccountSummaryCards = ({ summary }: { summary: CustomerDashboardSummary }) => <section className="account-summary-grid" aria-label="Thong ke don hang">
  <article className="account-summary-card"><ClipboardList size={20} /><span>Tong don hang</span><strong>{summary.orders.total}</strong></article>
  <article className="account-summary-card"><Clock3 size={20} /><span>Dang xu ly</span><strong>{summary.orders.pending}</strong></article>
  <article className="account-summary-card"><CircleCheck size={20} /><span>Da hoan tat</span><strong>{summary.orders.completed}</strong></article>
  <article className="account-summary-card"><WalletCards size={20} /><span>Gia tri don hang</span><strong>{Object.entries(summary.orders.totalsByCurrency).map(([currency, amount]) => `${amount.toLocaleString('vi-VN')} ${currency}`).join(' / ') || '0 VND'}</strong></article>
</section>;
