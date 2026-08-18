import express from 'express';
import { isSuperAdmin, maintenanceStatus, maintenanceWritesEnabled } from './catalogMaintenancePolicy.js';

export const createCatalogMaintenanceRouter = ({ env = process.env, catalogHealthService, readinessService } = {}) => {
  const router = express.Router();
  router.get('/admin/catalog/maintenance/status', async (req, res) => {
    let catalogHealth;
    try {
      catalogHealth = await catalogHealthService?.getHealth?.();
    } catch {
      catalogHealth = null;
    }
    const readiness = await readinessService?.evaluate?.({ force: true }) ?? { status: 'not_ready' };
    const canonicalSource = catalogHealthService?.isCanonicalSource?.() ?? true;
    return res.json(maintenanceStatus({
      enabled: maintenanceWritesEnabled(env),
      globalProductionReady: readiness.status === 'ready',
      superAdmin: isSuperAdmin(req),
      catalogHealthy: canonicalSource && catalogHealth?.status === 'healthy',
    }));
  });
  return router;
};
