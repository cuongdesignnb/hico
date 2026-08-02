import express from 'express';
import {
  createReconciliationService,
  ReconciliationNotFoundError,
  ReconciliationRequestError,
} from './reconciliationService.js';
import { ReconciliationValidationError } from './reconciliationValidation.js';

const sendError = (res, error) => {
  if (
    error instanceof ReconciliationRequestError
    || error instanceof ReconciliationValidationError
  ) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof ReconciliationNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  console.error(`[reconciliation] ${error?.name ?? 'UnknownError'}`);
  return res.status(500).json({
    error: 'Không thể xử lý reconciliation catalog.',
  });
};

export const createReconciliationRouter = ({
  reconciliationService = createReconciliationService(),
} = {}) => {
  const router = express.Router();

  router.post('/admin/catalog/reconciliation/run', async (_req, res) => {
    try {
      res.json(await reconciliationService.run());
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/admin/catalog/reconciliation/summary', async (_req, res) => {
    try {
      res.json(await reconciliationService.getSummary());
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/admin/catalog/reconciliation/items', async (req, res) => {
    try {
      res.json(await reconciliationService.listItems(req.query));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.put('/admin/catalog/reconciliation/items/:variantId', async (req, res) => {
    try {
      res.json(await reconciliationService.updateItem(
        req.params.variantId,
        req.body,
      ));
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
};
