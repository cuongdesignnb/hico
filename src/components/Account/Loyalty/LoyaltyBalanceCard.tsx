import { Award } from 'lucide-react';
import type { LoyaltyBalance } from '../../../types/loyalty';

export const LoyaltyBalanceCard = ({ balance }: { balance: LoyaltyBalance }) => <section className="account-loyalty-balance account-panel"><div className="account-panel-heading"><div><p className="account-kicker">Diem thuong</p><h2>So du diem</h2></div><Award size={24} aria-hidden="true" /></div><p className="account-big-number">{balance.balance.toLocaleString('vi-VN')}</p><p className="account-muted">diem co the theo doi tu so cai dat da du dieu kien</p><div className="account-loyalty-stats"><span>Da tich luy <strong>{balance.earned.toLocaleString('vi-VN')}</strong></span><span>Da hoan <strong>{balance.reversed.toLocaleString('vi-VN')}</strong></span></div></section>;
