import { RefreshCw } from 'lucide-react';

export const AccountErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="account-state account-error-state" role="alert"><p>Không thể tải dữ liệu tài khoản lúc này.</p><button type="button" className="account-button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> Thử lại</button></div>;
