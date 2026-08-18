const FULL_APPLY_PATH = /^\/catalog-sheet-sync\/[^/]+\/full-apply$/;

const pathWithoutAdminPrefix = (request) => {
  const originalPath = String(request.originalUrl ?? '').split('?')[0];
  if (originalPath.startsWith('/api/admin')) return originalPath.slice('/api/admin'.length) || '/';
  return String(request.path ?? originalPath).split('?')[0] || '/';
};

export const CATALOG_MAINTENANCE_DISABLED_CODE = 'CATALOG_MAINTENANCE_DISABLED';
export const CATALOG_MAINTENANCE_ROLE_CODE = 'CATALOG_MAINTENANCE_SUPER_ADMIN_REQUIRED';
export const CATALOG_MAINTENANCE_CATALOG_CODE = 'CATALOG_MAINTENANCE_CATALOG_UNHEALTHY';

export const isCatalogMaintenanceMutation = (request) => {
  if (request.method !== 'POST') return false;
  const path = pathWithoutAdminPrefix(request);
  return path === '/catalog/reset' || FULL_APPLY_PATH.test(path);
};

export const maintenanceWritesEnabled = (env = process.env) => (
  String(env.CATALOG_MAINTENANCE_WRITES_ENABLED ?? '').trim() === 'true'
);

export const isSuperAdmin = (request) => (
  Array.isArray(request.auth?.user?.roles)
  && request.auth.user.roles.includes('super_admin')
);

export const maintenanceStatus = ({ enabled, globalProductionReady, superAdmin, catalogHealthy }) => {
  const blockers = [];
  if (!enabled) blockers.push(CATALOG_MAINTENANCE_DISABLED_CODE);
  if (!superAdmin) blockers.push(CATALOG_MAINTENANCE_ROLE_CODE);
  if (!catalogHealthy) blockers.push(CATALOG_MAINTENANCE_CATALOG_CODE);
  const allowed = blockers.length === 0;
  return {
    enabled,
    globalProductionReady,
    resetAllowed: allowed,
    fullSyncAllowed: allowed,
    blockers,
  };
};

export { pathWithoutAdminPrefix };
