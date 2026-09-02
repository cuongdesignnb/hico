import { AlertTriangle, Boxes, RefreshCw, Tag } from 'lucide-react';
import type { QueueResponse } from '../../../types/catalogQueue';
import type {
  InventoryWarningItem,
  NeedsReviewItem,
  ProviderIssueItem,
  SkuConflictGroup,
} from '../../../types/catalogQueue';

interface ProductActivityFeedProps {
  skuConflicts: QueueResponse<SkuConflictGroup> | null;
  needsReview: QueueResponse<NeedsReviewItem> | null;
  providerIssues: QueueResponse<ProviderIssueItem> | null;
  inventoryWarnings: QueueResponse<InventoryWarningItem> | null;
  onTabChange: (tab: 'sku' | 'review' | 'provider' | 'inventory') => void;
}

const ProductActivityFeed = ({
  skuConflicts,
  needsReview,
  providerIssues,
  inventoryWarnings,
  onTabChange,
}: ProductActivityFeedProps) => {
  const getSkuDescription = () => {
    if (skuConflicts === null) return 'Chưa có dữ liệu';
    if (skuConflicts.total > 0) return `${skuConflicts.total} nhóm SKU trùng cần xử lý`;
    return 'Không có cảnh báo SKU';
  };

  const getReviewDescription = () => {
    if (needsReview === null) return 'Chưa có dữ liệu';
    if (needsReview.total > 0) return `${needsReview.total} variant cần xác nhận nguồn`;
    return 'Không có variant cần review';
  };

  const getProviderDescription = () => {
    if (providerIssues === null) return 'Chưa có dữ liệu';
    if (providerIssues.total > 0) return `${providerIssues.total} cảnh báo nguồn cấp`;
    return 'Không có cảnh báo nguồn cấp';
  };

  const getInventoryDescription = () => {
    if (inventoryWarnings === null) return 'Chưa có dữ liệu';
    if (inventoryWarnings.total > 0) return `${inventoryWarnings.total} cảnh báo tồn kho`;
    return 'Tồn kho ổn định';
  };

  const items = [
    {
      id: 'sku',
      icon: <Tag size={16} />,
      title: 'SKU trùng',
      description: getSkuDescription(),
      onClick: () => onTabChange('sku'),
      tone: skuConflicts && skuConflicts.total > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'review',
      icon: <AlertTriangle size={16} />,
      title: 'Cần review',
      description: getReviewDescription(),
      onClick: () => onTabChange('review'),
      tone: needsReview && needsReview.total > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'provider',
      icon: <RefreshCw size={16} />,
      title: 'Nguồn cấp',
      description: getProviderDescription(),
      onClick: () => onTabChange('provider'),
      tone: providerIssues && providerIssues.total > 0 ? 'info' : 'neutral',
    },
    {
      id: 'inventory',
      icon: <Boxes size={16} />,
      title: 'Tồn kho',
      description: getInventoryDescription(),
      onClick: () => onTabChange('inventory'),
      tone: inventoryWarnings && inventoryWarnings.total > 0 ? 'danger' : 'neutral',
    },
  ] as const;

  return (
    <div className="catalog-activity-feed">
      <div className="catalog-activity-feed__heading">
        <h3>Cảnh báo catalog</h3>
        <span>Các vấn đề cần xử lý trong danh mục.</span>
      </div>
      <ul className="catalog-activity-feed__list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`catalog-activity-feed__item catalog-activity-feed__item--${item.tone}`}
              onClick={item.onClick}
            >
              <span className="catalog-activity-feed__icon" aria-hidden="true">{item.icon}</span>
              <span className="catalog-activity-feed__body">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProductActivityFeed;