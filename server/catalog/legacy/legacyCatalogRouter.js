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
  mediaAssetRepository = null,
  legacySourceEnabled = true,
} = {}) => {
  const service = legacyCatalogService ?? createLegacyCatalogService({
    destinationsStore,
    packagesStore,
  });
  const router = express.Router();
  const resolveMediaInput = async (input = {}) => {
    if (!Object.prototype.hasOwnProperty.call(input, 'imageMediaId') || !mediaAssetRepository) return input;
    if (input.imageMediaId === null || input.imageMediaId === '') return { ...input, image: '' };
    const asset = await mediaAssetRepository.getById(input.imageMediaId);
    if (!asset) throw new LegacyCatalogProjectionError('MediaAsset không tồn tại hoặc đã archive.');
    return { ...input, image: asset.publicUrl };
  };
  if (!legacySourceEnabled) {
    router.use(['/admin/destinations', '/admin/packages', '/admin/catalog/source-status', '/admin/catalog/legacy-parity'], (_req, res) => res.status(410).json({ error: 'Nguồn HICO GỐC đã ngừng cho catalog mới.', code: 'HICO_GOC_SOURCE_RETIRED' }));
  }
  router.use(['/admin/destinations', '/admin/packages', '/admin/catalog/legacy-parity'], catalogGuard);

  router.get('/admin/destinations', async (_req, res) => {
    try {
      return res.json(await service.listDestinations());
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.post('/admin/destinations', async (req, res) => {
    try {
      return res.json(service.createDestination(await resolveMediaInput(req.body)));
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.put('/admin/destinations/:id', async (req, res) => {
    try {
      return sendResult(
        res,
        service.updateDestination(req.params.id, await resolveMediaInput(req.body)),
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
  router.post('/admin/packages', async (req, res) => {
    try {
      return res.json(service.createPackage(await resolveMediaInput(req.body)));
    } catch (error) {
      return sendError(res, error);
    }
  });
  router.put('/admin/packages/:id', async (req, res) => {
    try {
      return sendResult(
        res,
        service.updatePackage(req.params.id, await resolveMediaInput(req.body)),
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
