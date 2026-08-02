import type { CoverageOption } from '../types/productWizard';

export const getCoverageOptions = async (signal?: AbortSignal): Promise<CoverageOption[]> => {
  const response = await fetch('/api/admin/destinations', { signal });
  const payload: unknown = await response.json();
  if (!response.ok || !Array.isArray(payload)) {
    throw new Error('Không thể tải danh sách vùng phủ.');
  }
  return payload.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.name !== 'string') return [];
    return [{
      id: record.id,
      name: record.name,
      flag: typeof record.flag === 'string' ? record.flag : undefined,
      region: typeof record.region === 'string' ? record.region : undefined,
      isoCode: typeof record.isoCode === 'string' ? record.isoCode : undefined,
    }];
  });
};
