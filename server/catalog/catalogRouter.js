import express from 'express';
import { createCatalogService } from './catalogService.js';

const sendError = (res, error) => {
  console.error('[catalog]', error);
  res.status(500).json({ error: 'Không thể tải danh mục sản phẩm.' });
};

export const createCatalogRouter = ({
  catalogService = createCatalogService(),
  catalogGuard = (_req, _res, next) => next(),
} = {}) => {
  const router = express.Router();
  router.use((req, res, next) => {
    const isCatalogPath = req.path.startsWith('/catalog/') || req.path.startsWith('/admin/catalog/');
    return isCatalogPath ? catalogGuard(req, res, next) : next();
  });

  router.get('/admin/catalog/products', async (_req, res) => {
    try {
      res.json(await catalogService.listAdminProducts());
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/catalog/products', async (_req, res) => {
    try {
      res.json(await catalogService.listPublicProducts());
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/catalog/products/:id', async (req, res) => {
    try {
      const product = await catalogService.getPublicProduct(req.params.id);

      if (!product) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
      }

      return res.json(product);
    } catch (error) {
      return sendError(res, error);
    }
  });

  return router;
};
