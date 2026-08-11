import { SheetSyncError } from '../sheetSync/sheetSyncTypes.js';

export const ALIAS_NAMESPACES = new Set(['SIM_HICO_SKU_ESIM', 'SIM_HICO_SKU_PHYSICAL']);
export const ALIAS_STATUSES = new Set(['ACTIVE', 'REVOKED']);
export const ALIAS_MEDIUMS = new Set(['esim', 'physical_sim']);

export const normalizeExternalKey = (value) => String(value ?? '').trim().normalize('NFC').toUpperCase();

export const assertAliasInput = (input = {}) => {
  if (!ALIAS_NAMESPACES.has(input.namespace)) throw new SheetSyncError('External alias namespace is invalid.', { code: 'EXTERNAL_ALIAS_CONFLICT', status: 422 });
  if (!ALIAS_MEDIUMS.has(input.medium)) throw new SheetSyncError('External alias medium is invalid.', { code: 'EXTERNAL_ALIAS_MEDIUM_MISMATCH', status: 422 });
  const normalizedExternalKey = normalizeExternalKey(input.externalKey);
  if (!normalizedExternalKey) throw new SheetSyncError('External alias key is required.', { code: 'EXTERNAL_ALIAS_CONFLICT', status: 422 });
  const expectedMedium = input.namespace.endsWith('_PHYSICAL') ? 'physical_sim' : 'esim';
  if (input.medium !== expectedMedium) throw new SheetSyncError('External alias namespace and medium do not match.', { code: 'EXTERNAL_ALIAS_MEDIUM_MISMATCH', status: 422 });
  if (!input.variantId || typeof input.variantId !== 'string') throw new SheetSyncError('External alias target is required.', { code: 'EXTERNAL_ALIAS_TARGET_NOT_FOUND', status: 422 });
  return { ...input, normalizedExternalKey, status: input.status ?? 'ACTIVE' };
};

export const aliasKey = ({ namespace, normalizedExternalKey, medium }) => `${namespace}:${normalizedExternalKey}:${medium}`;
