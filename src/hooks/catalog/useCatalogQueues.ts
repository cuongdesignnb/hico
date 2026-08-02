import { useCallback, useEffect, useState } from 'react';
import { getInventoryWarnings, getNeedsReview, getProviderIssues, getSkuConflicts } from '../../services/catalogQueueApi';
import type { InventoryWarningItem, NeedsReviewItem, ProviderIssueItem, QueueResponse, SkuConflictGroup } from '../../types/catalogQueue';

export const useCatalogQueues = () => {
  const [skuConflicts, setSkuConflicts] = useState<QueueResponse<SkuConflictGroup> | null>(null);
  const [needsReview, setNeedsReview] = useState<QueueResponse<NeedsReviewItem> | null>(null);
  const [providerIssues, setProviderIssues] = useState<QueueResponse<ProviderIssueItem> | null>(null);
  const [inventoryWarnings, setInventoryWarnings] = useState<QueueResponse<InventoryWarningItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [sku, review, provider, inventory] = await Promise.all([
        getSkuConflicts('limit=5'),
        getNeedsReview('limit=5'),
        getProviderIssues('limit=5'),
        getInventoryWarnings('limit=5'),
      ]);
      setSkuConflicts(sku);
      setNeedsReview(review);
      setProviderIssues(provider);
      setInventoryWarnings(inventory);
    } catch {
      setSkuConflicts(null);
      setNeedsReview(null);
      setProviderIssues(null);
      setInventoryWarnings(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  return { skuConflicts, needsReview, providerIssues, inventoryWarnings, loading, reload };
};
