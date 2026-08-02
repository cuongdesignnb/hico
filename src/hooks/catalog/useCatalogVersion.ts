import { useCallback, useState } from 'react';

export const useCatalogVersion = (initialVersion: string) => {
  const [catalogVersionId, setCatalogVersionId] = useState(initialVersion);
  const updateCatalogVersion = useCallback((nextVersion: string) => {
    setCatalogVersionId(nextVersion);
  }, []);
  return { catalogVersionId, updateCatalogVersion };
};
