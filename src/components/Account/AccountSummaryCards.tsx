import { Award, Bell, ClipboardList, Clock3, CircleCheck, UsersRound, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CustomerDashboardSummary } from '../../types/customerDashboard';
import { CustomerAssetSummaryCards } from './Assets/CustomerAssetSummaryCards';

export const AccountSummaryCards = ({ summary }: { summary: CustomerDashboardSummary }) => <><section className="account-summary-grid" aria-label="Thống kê đơn hàng">
  <article className="account-summary-card"><ClipboardList size={20} /><span>Tổng đơn hàng</span><strong>{summary.orders.total}</strong></article>
  <article className="account-summary-card"><Clock3 size={20} /><span>Đang xử lý</span><strong>{summary.orders.pending}</strong></article>
  <article className="account-summary-card"><CircleCheck size={20} /><span>Đã hoàn tất</span><strong>{summary.orders.completed}</strong></article>
  <article className="account-summary-card"><WalletCards size={20} /><span>Giá trị đơn hàng</span><strong>{Object.entries(summary.orders.totalsByCurrency).map(([currency, amount]) => `${amount.toLocaleString('vi-VN')} ${currency}`).join(' / ') || '0 VND'}</strong></article>
</section><section className="account-summary-grid account-feature-summary-grid">{summary.capabilities.loyalty && summary.loyaltySummary.available && <Link className="account-summary-card" to="/tai-khoan/diem-thuong"><Award size={20} /><span>Điểm thưởng</span><strong>{summary.loyaltySummary.balance?.toLocaleString('vi-VN') ?? 0}</strong></Link>}{summary.capabilities.referrals && summary.referralSummary.available && <Link className="account-summary-card" to="/tai-khoan/gioi-thieu"><UsersRound size={20} /><span>Giới thiệu</span><strong>Xem chi tiết</strong></Link>}{summary.capabilities.notifications && summary.notificationsSummary.available && <Link className="account-summary-card" to="/tai-khoan/thong-bao"><Bell size={20} /><span>Thông báo chưa đọc</span><strong>{summary.notificationsSummary.unreadCount ?? 0}</strong></Link>}</section>{summary.assetSummary && <CustomerAssetSummaryCards summary={summary.assetSummary} />}</>;
