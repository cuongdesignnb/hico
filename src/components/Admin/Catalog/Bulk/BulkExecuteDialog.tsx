import { Play } from 'lucide-react';

interface BulkExecuteDialogProps {
  disabled: boolean;
  loading: boolean;
  onExecute: () => void;
}

const BulkExecuteDialog = ({ disabled, loading, onExecute }: BulkExecuteDialogProps) => <button type="button" className="catalog-primary-button" disabled={disabled || loading} onClick={onExecute}><Play size={15} /> {loading ? 'Đang thực thi...' : 'Xác nhận thực thi'}</button>;

export default BulkExecuteDialog;
