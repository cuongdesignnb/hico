import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CustomerOrder } from '../../types/customerOrder';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrderCurrencyTotals } from './OrderCurrencyTotals';

export const RecentOrders = ({ orders }: { orders: CustomerOrder[] }) => <section className="account-panel">
  <div className="account-panel-heading"><div><p className="account-kicker">Lich su gan day</p><h2>Don hang moi nhat</h2></div><Link className="account-text-link" to="/tai-khoan/don-hang">Xem tat ca <ArrowRight size={15} /></Link></div>
  {orders.length ? <div className="order-list">{orders.map((order) => <Link className="order-list-row" key={order.orderId} to={`/tai-khoan/don-hang/${encodeURIComponent(order.orderId)}`}><div><strong>{order.orderId}</strong><span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : 'Chua co ngay'}</span></div><div className="order-row-meta"><OrderCurrencyTotals totals={order.totalsByCurrency} /><OrderStatusBadge status={order.status} /><ArrowRight size={16} aria-hidden="true" /></div></Link>)}</div> : <p className="account-muted">Chua co don hang.</p>}
</section>;
