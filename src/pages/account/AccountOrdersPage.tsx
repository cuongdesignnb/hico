import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';
import { useCustomerOrders } from '../../hooks/customer/useCustomerOrders';
import { usePendingOrderRefresh } from '../../hooks/customer/usePendingOrderRefresh';
import { AccountErrorState } from '../../components/Account/AccountErrorState';
import { AccountEmptyState } from '../../components/Account/AccountEmptyState';
import { AccountLoadingState } from '../../components/Account/AccountLoadingState';
import { OrderCurrencyTotals } from '../../components/Account/OrderCurrencyTotals';
import { OrderStatusBadge } from '../../components/Account/OrderStatusBadge';
import { useState } from 'react';

export const AccountOrdersPage = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useCustomerOrders(page, status || undefined);
  usePendingOrderRefresh(Boolean(data?.items.some((order) => order.fulfillment.pending)), reload);
  const changeStatus = (value: string) => { setStatus(value); setPage(1); };
  return <><SeoHead path="/tai-khoan/don-hang" metadata={{ ...defaultMetadata(), title: 'Đơn hàng | HICO eSIM', indexable: false }} noindex /><div className="account-page-heading"><div><p className="account-kicker">Lịch sử mua hàng</p><h2>Đơn hàng của bạn</h2></div><label className="account-filter">Lọc trạng thái<select value={status} onChange={(event) => changeStatus(event.target.value)}><option value="">Tất cả</option><option value="PENDING">Chờ xử lý</option><option value="PROVISIONED">Đã kích hoạt</option><option value="COMPLETED">Hoàn tất</option><option value="CANCELLED">Đã hủy</option></select></label></div>{loading && !data ? <AccountLoadingState /> : error && !data ? <AccountErrorState onRetry={() => void reload()} /> : data?.items.length ? <><div className="account-panel order-table">{data.items.map((order) => <Link className="order-table-row" key={order.orderId} to={`/tai-khoan/don-hang/${encodeURIComponent(order.orderId)}`}><div><strong>{order.orderId}</strong><span>{order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : 'Chưa có ngày'}</span></div><span>{order.items.length} sản phẩm</span><OrderCurrencyTotals totals={order.totalsByCurrency} /><OrderStatusBadge status={order.status} /></Link>)}</div><div className="account-pagination"><button type="button" className="account-icon-button" disabled={page <= 1} aria-label="Trang trước" onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button><span>Trang {data.pagination.page} / {data.pagination.totalPages}</span><button type="button" className="account-icon-button" disabled={page >= data.pagination.totalPages} aria-label="Trang sau" onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button></div></> : <AccountEmptyState />}</>;
};
