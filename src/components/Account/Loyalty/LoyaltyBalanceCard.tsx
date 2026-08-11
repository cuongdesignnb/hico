import { Award } from 'lucide-react';
import type { LoyaltyBalance } from '../../../types/loyalty';

export const LoyaltyBalanceCard = ({ balance }: { balance: LoyaltyBalance }) => <section className="account-loyalty-balance account-panel"><div className="account-panel-heading"><div><p className="account-kicker">Điểm thưởng</p><h2>Số dư điểm</h2></div><Award size={24} aria-hidden="true" /></div><p className="account-big-number">{balance.balance.toLocaleString('vi-VN')}</p><p className="account-muted">Điểm có thể theo dõi từ số đơn hàng đủ điều kiện</p><div className="account-loyalty-stats"><span>Đã tích lũy <strong>{balance.earned.toLocaleString('vi-VN')}</strong></span><span>Đã hoàn <strong>{balance.reversed.toLocaleString('vi-VN')}</strong></span></div></section>;
