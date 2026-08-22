import express from 'express';
import { createCatalogService } from './catalogService.js';
import { createPublicRouteResolver } from '../seo/publicRouteResolver.js';
import { toPublicProduct } from './publicCatalogProjection.js';
import { createProviderOfferRepository } from '../providers/providerOfferRepository.js';

const sendError = (res, error) => {
  console.error('[catalog]', error);
  res.status(500).json({ error: 'Không thể tải danh mục sản phẩm.' });
};

export const createCatalogRouter = ({
  mediaAssetRepository = null,
  providerRepository = createProviderOfferRepository(),
  catalogService = createCatalogService(undefined, { mediaAssetRepository, providerRepository }),
  publicRouteResolver = createPublicRouteResolver(),
  catalogGuard = (_req, _res, next) => next(),
} = {}) => {
  const router = express.Router();
  const mediaAssets = async () => mediaAssetRepository?.list?.() ?? [];
  const providerOffers = async () => providerRepository?.listOffers?.() ?? [];
  router.use((req, res, next) => {
    const isCatalogPath = req.path.startsWith('/catalog/') || req.path.startsWith('/admin/catalog/');
    return isCatalogPath ? catalogGuard(req, res, next) : next();
  });

  router.get('/admin/catalog/products', async (req, res) => {
    try {
      const filters = {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        operation: typeof req.query.operation === 'string' ? req.query.operation : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        unresolved: req.query.unresolved === 'true' ? true : undefined,
        coverage: typeof req.query.coverage === 'string' ? req.query.coverage : undefined,
        medium: typeof req.query.medium === 'string' ? req.query.medium : undefined,
        supplier: typeof req.query.supplier === 'string' ? req.query.supplier : undefined,
        page: typeof req.query.page === 'string' ? req.query.page : undefined,
        pageSize: typeof req.query.pageSize === 'string' ? req.query.pageSize : undefined,
      };
      res.json(await catalogService.listAdminProducts({ filters, paginate: true }));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/catalog/products', async (req, res) => {
    try {
      const filters = {
        operation: typeof req.query.operation === 'string' ? req.query.operation : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        medium: typeof req.query.medium === 'string' ? req.query.medium : undefined,
        coverage: typeof req.query.coverage === 'string' ? req.query.coverage : undefined,
        supplier: typeof req.query.supplier === 'string' ? req.query.supplier : undefined,
        currency: typeof req.query.currency === 'string' ? req.query.currency : undefined,
        inStock: req.query.inStock === 'true' ? true : undefined,
        deviceGeneration: typeof req.query.deviceGeneration === 'string' ? req.query.deviceGeneration : undefined,
        page: typeof req.query.page === 'string' ? req.query.page : undefined,
        pageSize: typeof req.query.pageSize === 'string' ? req.query.pageSize : undefined,
        sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      };
      res.json(await catalogService.listPublicProducts({ filters, paginate: true }));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/catalog/categories', async (_req, res) => {
    try {
      res.json({ items: await catalogService.listPublicCategories() });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/catalog/products/by-slug/:slug', async (req, res) => {
    try {
      const result = await publicRouteResolver.resolveProductSlug(req.params.slug);
      if (result.invalid) return res.status(400).json({ error: 'Đường dẫn sản phẩm không hợp lệ.', code: 'INVALID_SLUG' });
      if (result.redirect) return res.json({ redirect: result.redirect, permanent: true });
      if (!result.product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.', code: 'PRODUCT_NOT_FOUND' });
      const canonicalProduct = await catalogService.getPublicProductBySlug?.(result.product.slug ?? req.params.slug);
      if (canonicalProduct) return res.json(canonicalProduct);
      return res.json(toPublicProduct(result.product, result.product.variants ?? [], { mediaAssets: await mediaAssets(), providerOffers: await providerOffers() }));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/catalog/products/:productId/variants', async (req, res) => {
    try {
      const variants = await catalogService.getPublicVariants(req.params.productId);
      if (!variants) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.', code: 'PRODUCT_NOT_FOUND' });
      return res.json({ items: variants });
    } catch (error) {
      return sendError(res, error);
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
