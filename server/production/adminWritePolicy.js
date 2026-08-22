import { isCatalogMaintenanceMutation } from '../catalog/maintenance/catalogMaintenancePolicy.js';

const safeMutationKeys = new Set([
  'PUT /settings/integrations/google-sheet',
  'PUT /settings/integrations/google-sheet/credential',
  'DELETE /settings/integrations/google-sheet/credential',
  'POST /settings/integrations/google-sheet/test',
  'POST /settings/integrations/google-sheet/discover',
  'POST /settings/integrations/google-sheet/discover-header',
  'POST /settings/integrations/google-sheet/validate-range',
  'POST /settings/integrations/google-sheet/preview',
  'POST /catalog-sheet-sync/preview',
  'POST /catalog-sheet-sync/quick-preview',
  'POST /catalog-sheet-sync/full-preview',
  'POST /catalog-sheet-sync/preview-jobs',
]);
const previewJobCancelPath = /^\/catalog-sheet-sync\/preview-jobs\/[^/]+\/cancel$/;

const pathWithoutAdminPrefix = (request) => {
  const originalPath = String(request.originalUrl ?? '').split('?')[0];
  if (originalPath.startsWith('/api/admin')) return originalPath.slice('/api/admin'.length) || '/';
  return String(request.path ?? originalPath).split('?')[0] || '/';
};

export const SAFE_ADMIN_MUTATIONS = Object.freeze([...safeMutationKeys]);

export const isProductionSafeAdminMutation = (request) => (
  safeMutationKeys.has(`${request.method} ${pathWithoutAdminPrefix(request)}`)
  || (request.method === 'POST'
    && previewJobCancelPath.test(pathWithoutAdminPrefix(request))
    && !/%2f|%5c/i.test(pathWithoutAdminPrefix(request)))
);

export { isCatalogMaintenanceMutation };
