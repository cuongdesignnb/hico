import {
  CATALOG_MAINTENANCE_CATALOG_CODE,
  CATALOG_MAINTENANCE_DISABLED_CODE,
  CATALOG_MAINTENANCE_ROLE_CODE,
  isCatalogMaintenanceMutation,
  isSuperAdmin,
  maintenanceWritesEnabled,
} from './catalogMaintenancePolicy.js';

const errorResponse = (res, status, error, code) => res.status(status).json({ error, code });

export const createCatalogMaintenanceGuard = ({ env = process.env, catalogHealthService, readinessService } = {}) => async (req, res, next) => {
  if (!isCatalogMaintenanceMutation(req)) return next();
  if (!maintenanceWritesEnabled(env)) return errorResponse(res, 423, 'Chế độ bảo trì Catalog chưa được bật.', CATALOG_MAINTENANCE_DISABLED_CODE);
  if (!isSuperAdmin(req)) return errorResponse(res, 403, 'Catalog Maintenance chỉ dành cho Super Admin.', CATALOG_MAINTENANCE_ROLE_CODE);

  let catalogHealth;
  try {
    catalogHealth = await catalogHealthService?.getHealth?.();
  } catch {
    catalogHealth = null;
  }
  const canonicalSource = catalogHealthService?.isCanonicalSource?.() ?? true;
  if (!canonicalSource || catalogHealth?.status !== 'healthy') return errorResponse(res, 503, 'Canonical catalog chưa sẵn sàng cho thao tác bảo trì.', CATALOG_MAINTENANCE_CATALOG_CODE);

  const readiness = await readinessService?.evaluate?.({ force: true }) ?? { status: 'not_ready' };
  req.catalogMaintenance = { maintenanceMode: true, globalProductionReady: readiness.status === 'ready' };
  return next();
};
