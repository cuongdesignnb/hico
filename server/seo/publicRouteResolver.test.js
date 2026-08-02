import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicRouteResolver } from './publicRouteResolver.js';
import { createRobotsTxt } from './robotsService.js';
import { createSitemapXml } from './sitemapService.js';

const product = (overrides = {}) => ({
  id: 'product-1',
  name: 'Viet Nam',
  slug: 'viet-nam-esim',
  operation: 'new_subscription',
  coverageType: 'country',
  status: 'active',
  ...overrides,
});

const variant = (overrides = {}) => ({
  id: 'variant-1',
  productId: 'product-1',
  sku: 'VN-1',
  active: true,
  archived: false,
  needsReview: false,
  ...overrides,
});

const createResolver = ({ products = [product()], variants = [variant()], history = [], articles = [] } = {}) => createPublicRouteResolver({
  catalogReader: { async readCatalog() { return { products, variants }; } },
  slugHistoryRepository: { async list() { return history; } },
  articleProvider: async () => articles,
  now: () => new Date('2026-08-01T00:00:00.000Z'),
});

test('resolves current and historical canonical product slugs', async () => {
  const resolver = createResolver({
    history: [
      { entityId: 'product-1', oldSlug: 'old-viet-nam', newSlug: 'middle-viet-nam' },
      { entityId: 'product-1', oldSlug: 'middle-viet-nam', newSlug: 'viet-nam-esim' },
    ],
  });
  assert.equal((await resolver.resolveProductSlug('viet-nam-esim')).product.id, 'product-1');
  assert.deepEqual(await resolver.resolveProductSlug('old-viet-nam'), {
    redirect: '/san-pham/viet-nam-esim',
    permanent: true,
    product: (await resolver.listProducts())[0],
  });
});

test('does not expose drafts, unavailable variants, or history cycles', async () => {
  const resolver = createResolver({
    products: [product({ status: 'draft' })],
    variants: [variant()],
    history: [
      { entityId: 'product-1', oldSlug: 'a', newSlug: 'b' },
      { entityId: 'product-1', oldSlug: 'b', newSlug: 'a' },
    ],
  });
  assert.equal((await resolver.listProducts()).length, 0);
  assert.deepEqual(await resolver.resolveProductSlug('a'), { notFound: true, cycle: true });
  assert.deepEqual(await resolver.resolveProductSlug('../secret'), { invalid: true });
});

test('resolves public coverage and articles only', async () => {
  const resolver = createResolver({
    articles: [
      { id: 'published', title: 'Travel tips', status: 'published' },
      { id: 'draft', title: 'Hidden draft', status: 'draft' },
      { id: 'scheduled', title: 'Scheduled', status: 'scheduled', scheduledDate: '2026-08-02T00:00:00.000Z' },
    ],
  });
  assert.equal((await resolver.resolveCoverageSlug('viet-nam')).coverage.products.length, 1);
  assert.equal((await resolver.resolveArticleSlug('travel-tips')).article.id, 'published');
  assert.deepEqual(await resolver.resolveArticleSlug('hidden-draft'), { notFound: true });
});

test('sitemap and robots publish only canonical public routes', () => {
  const xml = createSitemapXml({
    siteUrl: 'https://hico.example/',
    products: [product()],
    coverage: [{ slug: 'viet-nam', type: 'country' }],
    articles: [{ title: 'Travel tips' }],
  });
  assert.match(xml, /https:\/\/hico\.example\/san-pham\/viet-nam-esim/);
  assert.doesNotMatch(xml, /old-viet-nam/);
  assert.match(createRobotsTxt({ siteUrl: 'https://hico.example', environment: 'production' }), /Disallow: \/quan-tri/);
  assert.equal(createRobotsTxt({ siteUrl: 'https://hico.example', environment: 'development' }), 'User-agent: *\nDisallow: /\n');
});
