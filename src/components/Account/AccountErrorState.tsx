import { RefreshCw } from 'lucide-react';

export const AccountErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="account-state account-error-state" role="alert"><p>Khong the tai du lieu tai khoan luc nay.</p><button type="button" className="account-button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> Thu lai</button></div>;
