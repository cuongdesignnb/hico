import { useCallback, useMemo, useState } from 'react';
import type { BulkFilter, BulkSelection } from '../../types/catalogBulk';

export const useBulkSelection = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterSelection, setFilterSelection] = useState<BulkFilter | null>(null);
  const selection = useMemo<BulkSelection>(() => (
    filterSelection
      ? { mode: 'filter', filter: filterSelection, excludedIds: [] }
      : { mode: 'ids', ids: selectedIds }
  ), [filterSelection, selectedIds]);

  const toggle = useCallback((id: string) => {
    setFilterSelection(null);
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }, []);

  const selectPage = useCallback((ids: string[]) => {
    setFilterSelection(null);
    setSelectedIds((current) => {
      const allSelected = ids.length > 0 && ids.every((id) => current.includes(id));
      return allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])];
    });
  }, []);

  const selectFilter = useCallback((filter: BulkFilter) => {
    setFilterSelection(filter);
    setSelectedIds([]);
  }, []);

  const clear = useCallback(() => {
    setFilterSelection(null);
    setSelectedIds([]);
  }, []);

  return {
    selection,
    selectedIds,
    isFilterSelection: filterSelection !== null,
    toggle,
    selectPage,
    selectFilter,
    clear,
  };
};
