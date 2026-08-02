import { requestJson } from './catalogWriteApi';
import type {
  InventoryWarningItem,
  NeedsReviewItem,
  ProviderIssueItem,
  QueueResponse,
  SkuConflictGroup,
} from '../types/catalogQueue';

const queue = <T>(path: string, search = '') => requestJson<QueueResponse<T>>(`${path}${search ? `?${search}` : ''}`);

export const getSkuConflicts = (search = '') => queue<SkuConflictGroup>('/api/admin/catalog/queues/sku-conflicts', search);
export const getNeedsReview = (search = '') => queue<NeedsReviewItem>('/api/admin/catalog/queues/needs-review', search);
export const getProviderIssues = (search = '') => queue<ProviderIssueItem>('/api/admin/catalog/queues/provider-issues', search);
export const getInventoryWarnings = (search = '') => queue<InventoryWarningItem>('/api/admin/catalog/queues/inventory-warnings', search);
