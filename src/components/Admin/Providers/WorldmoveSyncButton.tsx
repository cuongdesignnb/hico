import { RefreshCw } from 'lucide-react';

interface WorldmoveSyncButtonProps {
  syncing: boolean;
  onSync: () => void;
}

const WorldmoveSyncButton = ({
  syncing,
  onSync,
}: WorldmoveSyncButtonProps) => (
  <button
    type="button"
    className="provider-sync-button"
    onClick={onSync}
    disabled={syncing}
    title={syncing ? 'Đang đồng bộ Worldmove' : 'Đồng bộ Worldmove'}
  >
    <RefreshCw
      size={16}
      className={syncing ? 'provider-sync-icon-active' : undefined}
    />
    <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ Worldmove'}</span>
  </button>
);

export default WorldmoveSyncButton;
