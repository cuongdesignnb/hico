import express from 'express';
import {
  createLegacyCatalogService,
  LegacyCatalogProjectionError,
  LegacyCatalogWriteLockedError,
} from './legacyCatalogService.js';

const sendError = (res, error) => {
  if (error instanceof LegacyCatalogWriteLockedError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof LegacyCatalogProjectionError) {
    return res.status(409).json({ error: error.message });
  }
  console.error(`[legacy-catalog] ${error?.name ?? 'UnknownError'}`);
  return res.status(500).json({ error: 'Không thể xử lý catalog legacy.' });
};

const sendResult = (res, result, notFoundMessage) => (
  result
    ? res.json(result)
    : res.status(404).json({ error: notFoundMessage })
);

export const createLegacyCatalogRouter = ({
  legacyCatalogService,
  destinationsStore,
  packagesStore,
  catalogGuard = (_req, _res, next) => next(),
} = {}) => {
  const service = legacyCatalogService ?? createLegacyCatalogService({
    destinationsStore,
    packagesStore,
  });
  const router = express.Router();
  router.use(['/admin/destinations', '/admin/packages', '/admin/catalog/legacy-parity'], catalogGuard);

  router.get('/admin/destinations', async (_req, res) => {
    try {
      return res.json(await service.listDestinations());
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.post('/admin/destinations', (req, res) => {
    try {
      return res.json(service.createDestination(req.body));
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.put('/admin/destinations/:id', (req, res) => {
    try {
      return sendResult(
        res,
        service.updateDestination(req.params.id, req.body),
        'Destination not found',
      );
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.delete('/admin/destinations/:id', (req, res) => {
    try {
      return res.json(service.deleteDestination(req.params.id));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/admin/packages', async (_req, res) => {
    try {
      return res.json(await service.listPackages());
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.post('/admin/packages', (req, res) => {
    try {
      return res.json(service.createPackage(req.body));
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.put('/admin/packages/:id', (req, res) => {
    try {
      return sendResult(
        res,
        service.updatePackage(req.params.id, req.body),
        'Package not found',
      );
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.delete('/admin/packages/:id', (req, res) => {
    try {
      return res.json(service.deletePackage(req.params.id));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/admin/catalog/source-status', async (_req, res) => {
    try {
      return res.json(await service.getSourceStatus());
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.post('/admin/catalog/legacy-parity/run', async (_req, res) => {
    try {
      const report = await service.runParity();
      return res.status(report.success ? 200 : 409).json(report);
    } catch (error) {
      return sendError(res, error);
    }
  });

  return router;
};
