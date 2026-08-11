import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AccountEmptyState = ({ label = 'Chưa có đơn hàng.' }: { label?: string }) => <div className="account-empty-state"><ShoppingBag size={28} /><p>{label}</p><Link className="account-button" to="/san-pham">Khám phá sản phẩm</Link></div>;
