import express from 'express';
import {
  CatalogMigrationError,
  createCatalogMigrationService,
} from './catalogMigrationService.js';
import {
  CanonicalCatalogValidationError,
} from '../canonical/canonicalCatalogValidation.js';

const sendError = (res, error) => {
  if (
    error instanceof CatalogMigrationError
    || error instanceof CanonicalCatalogValidationError
    || error instanceof SyntaxError
  ) {
    return res.status(409).json({ error: error.message });
  }
  console.error(`[catalog-migration] ${error?.name ?? 'UnknownError'}`);
  return res.status(500).json({
    error: 'Không thể xử lý migration catalog.',
  });
};

export const createCatalogMigrationRouter = ({
  migrationService = createCatalogMigrationService(),
} = {}) => {
  const router = express.Router();

  router.post('/admin/catalog/migration/validate', async (_req, res) => {
    try {
      const result = await migrationService.validate();
      return res.status(result.valid ? 200 : 409).json(result);
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/admin/catalog/migration/run', async (_req, res) => {
    try {
      return res.json(await migrationService.run());
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/admin/catalog/migration/status', async (_req, res) => {
    try {
      return res.json(await migrationService.getStatus());
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/admin/catalog/migration/reports/:migrationId', async (req, res) => {
    try {
      const report = await migrationService.getReport(req.params.migrationId);
      if (!report) {
        return res.status(404).json({ error: 'Không tìm thấy migration report.' });
      }
      return res.json(report);
    } catch (error) {
      return sendError(res, error);
    }
  });

  return router;
};
