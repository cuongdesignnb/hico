import express from 'express';
import { createPublicRouteResolver } from './publicRouteResolver.js';
import { createSitemapXml } from './sitemapService.js';
import { createRobotsTxt } from './robotsService.js';

const notFound = (res) => res.status(404).json({ error: 'Content not found.', code: 'NOT_FOUND' });
const invalidSlug = (res) => res.status(400).json({ error: 'Invalid path.', code: 'INVALID_SLUG' });

const requestSiteUrl = (req, env) => {
  const configured = env.PUBLIC_SITE_URL ?? env.VITE_PUBLIC_SITE_URL;
  if (configured) {
    try { return new URL(configured).toString().replace(/\/$/, ''); } catch { /* Fall back to request origin. */ }
  }
  return `${req.protocol}://${req.get('host')}`;
};

export const createSeoRouter = ({ resolver = createPublicRouteResolver(), env = process.env } = {}) => {
  const router = express.Router();
  router.get('/catalog/products/by-slug/:slug', async (req, res) => {
    try {
      const result = await resolver.resolveProductSlug(req.params.slug);
      if (result.invalid) return invalidSlug(res);
      if (result.redirect) return res.json({ redirect: result.redirect, permanent: true });
      if (!result.product) return notFound(res);
      return res.json(result.product);
    } catch {
      return res.status(500).json({ error: 'Unable to resolve product.', code: 'SEO_RESOLVE_FAILED' });
    }
  });
  router.get('/catalog/coverage/by-slug/:slug', async (req, res) => {
    try {
      const result = await resolver.resolveCoverageSlug(req.params.slug);
      if (result.invalid) return invalidSlug(res);
      return result.coverage ? res.json(result.coverage) : notFound(res);
    } catch {
      return res.status(500).json({ error: 'Unable to resolve coverage.', code: 'SEO_RESOLVE_FAILED' });
    }
  });
  router.get('/articles/by-slug/:slug', async (req, res) => {
    try {
      const result = await resolver.resolveArticleSlug(req.params.slug);
      if (result.invalid) return invalidSlug(res);
      return result.article ? res.json(result.article) : notFound(res);
    } catch {
      return res.status(500).json({ error: 'Unable to resolve article.', code: 'SEO_RESOLVE_FAILED' });
    }
  });
  router.get('/sitemap.xml', async (req, res) => {
    try {
      const [products, coverage, articles] = await Promise.all([resolver.listProducts(), resolver.listCoverage(), resolver.listArticles()]);
      res.type('application/xml').send(createSitemapXml({ siteUrl: requestSiteUrl(req, env), products, coverage, articles }));
    } catch {
      res.status(503).type('text/plain').send('Sitemap is temporarily unavailable.');
    }
  });
  router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(createRobotsTxt({ siteUrl: requestSiteUrl(req, env), environment: env.SEO_ENV ?? 'development' }));
  });
  return router;
};
