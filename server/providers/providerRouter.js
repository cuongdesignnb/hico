import express from 'express';
import {
  WorldmoveConfigurationError,
  WorldmoveRequestError,
} from './worldmove/worldmoveClient.js';
import { ProviderOfferValidationError } from './providerOfferValidation.js';
import { createWorldmoveCatalogService } from './worldmove/worldmoveCatalogService.js';

const sendProviderError = (res, error) => {
  if (error instanceof WorldmoveConfigurationError) {
    return res.status(503).json({
      error: 'Worldmove chưa được cấu hình đầy đủ.',
    });
  }

  if (
    error instanceof WorldmoveRequestError
    || error instanceof ProviderOfferValidationError
  ) {
    return res.status(502).json({
      error: error.message,
    });
  }

  console.error('[provider-catalog]', error);
  return res.status(500).json({
    error: 'Không thể xử lý danh mục nhà cung cấp.',
  });
};

export const createProviderRouter = ({
  worldmoveCatalogService = createWorldmoveCatalogService(),
} = {}) => {
  const router = express.Router();

  router.get('/admin/providers/worldmove/offers', async (_req, res) => {
    try {
      return res.json(await worldmoveCatalogService.listOffers());
    } catch (error) {
      return sendProviderError(res, error);
    }
  });

  router.get('/admin/providers/worldmove/offers/:id', async (req, res) => {
    try {
      const offer = await worldmoveCatalogService.getOfferById(req.params.id);

      if (!offer) {
        return res.status(404).json({
          error: 'Không tìm thấy offer Worldmove.',
        });
      }

      return res.json(offer);
    } catch (error) {
      return sendProviderError(res, error);
    }
  });

  router.post('/admin/providers/worldmove/sync', async (_req, res) => {
    try {
      return res.json(await worldmoveCatalogService.syncOffers());
    } catch (error) {
      return sendProviderError(res, error);
    }
  });

  return router;
};
