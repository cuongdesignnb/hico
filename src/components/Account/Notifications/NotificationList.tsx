import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CustomerNotification } from '../../../types/customerNotification';

export const NotificationList = ({ items, onRead, onReadAll, busy }: { items: CustomerNotification[]; onRead: (id: string) => Promise<void>; onReadAll: () => Promise<void>; busy?: boolean }) => <section className="account-panel account-notification-panel">
  <div className="account-panel-heading"><div><p className="account-kicker">Thông báo</p><h2>Cập nhật từ tài khoản</h2></div><button type="button" className="account-button" onClick={() => void onReadAll()} disabled={busy || !items.some((item) => item.status === 'UNREAD')}><CheckCheck size={16} /> Đọc tất cả</button></div>
  {items.length ? <div className="account-notification-list">{items.map((item) => <article className={`account-notification-row${item.status === 'UNREAD' ? ' unread' : ''}`} key={item.id}><Bell size={19} aria-hidden="true" /><div><strong>{item.title}</strong><p>{item.message}</p><span>{new Date(item.createdAt).toLocaleString('vi-VN')}</span>{item.actionPath && <Link to={item.actionPath} className="account-text-link">Mở chi tiết <ExternalLink size={14} /></Link>}</div>{item.status === 'UNREAD' && <button type="button" className="account-icon-button" aria-label="Đánh dấu đã đọc" title="Đánh dấu đã đọc" onClick={() => void onRead(item.id)} disabled={busy}><CheckCheck size={17} /></button>}</article>)}</div> : <div className="account-empty-state"><Bell size={28} /><p>Chưa có thông báo.</p></div>}
</section>;
