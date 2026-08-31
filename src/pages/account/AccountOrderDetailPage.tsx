import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';
import { useCustomerOrderDetail } from '../../hooks/customer/useCustomerOrderDetail';
import { AccountErrorState } from '../../components/Account/AccountErrorState';
import { AccountLoadingState } from '../../components/Account/AccountLoadingState';
import { OrderCurrencyTotals } from '../../components/Account/OrderCurrencyTotals';
import { OrderStatusBadge } from '../../components/Account/OrderStatusBadge';

export const AccountOrderDetailPage = () => {
  const orderId = decodeURIComponent(useParams().orderId ?? '');
  const { data: order, error, loading, reload } = useCustomerOrderDetail(orderId);
  return <><SeoHead path={`/tai-khoan/don-hang/${encodeURIComponent(orderId)}`} metadata={{ ...defaultMetadata(), title: 'Chi tiết đơn hàng | HICO eSIM', indexable: false }} noindex /><Link className="account-back-link account-content-back" to="/tai-khoan/don-hang"><ArrowLeft size={16} /> Quay lại đơn hàng</Link>{loading && !order ? <AccountLoadingState /> : error && !order ? <AccountErrorState onRetry={() => void reload()} /> : order ? <div className="account-detail"><div className="account-page-heading"><div><p className="account-kicker">Chi tiết đơn hàng</p><h2>{order.orderId}</h2><p className="account-muted">{order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : 'Chưa có ngày tạo'}</p></div><OrderStatusBadge status={order.status} /></div><div className="account-detail-grid"><section className="account-panel"><h3>Sản phẩm</h3><div className="detail-items">{order.items.map((item, index) => <div className="detail-item" key={`${item.variantId ?? item.productName}-${index}`}><div><strong>{item.productName}</strong><span>{item.quantity} x {item.unitPrice.toLocaleString('vi-VN')} {item.currency}</span></div><span>{(item.quantity * item.unitPrice).toLocaleString('vi-VN')} {item.currency}</span></div>)}</div><div className="detail-total"><span>Tổng tạm tính</span><OrderCurrencyTotals totals={order.totalsByCurrency} /></div></section><section className="account-panel"><h3>Xử lý đơn hàng</h3><p className="account-muted">{order.fulfillment.pending ? 'Đơn hàng đang được xử lý.' : order.fulfillment.cancelled ? 'Đơn hàng đã hủy.' : 'Đơn hàng đã được cập nhật.'}</p><div className="detail-status-line"><span>Trạng thái</span><OrderStatusBadge status={order.status} /></div>{order.shipping && <div className="detail-shipping"><h3>Thông tin giao hàng</h3><p>{order.shipping.recipientName || 'Không có tên người nhận'}</p><p>{order.shipping.city || 'Không có khu vực'}</p><p>{order.shipping.phone || 'Không có số điện thoại'}</p></div>}</section></div></div> : null}</>;
};
