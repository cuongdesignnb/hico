import { createCanonicalCatalogReader } from '../catalog/canonical/canonicalCatalogReader.js';
import { createCatalogSlugHistoryRepository } from '../catalog/write/catalogSlugHistoryRepository.js';
import { getSeoVisibility, isPublicArticle } from './seoVisibility.js';
import { cloneSeedCategories, projectProductCategory } from '../catalog/categories/catalogCategories.js';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugify = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const getCanonicalProductPath = (product) => {
  if (product.operation === 'topup') return `/nap-them/${product.slug}`;
  if (product.operation === 'device_sale') return `/thiet-bi/${product.slug}`;
  return `/san-pham/${product.slug}`;
};

export const getArticleSlug = (article) => {
  const explicit = typeof article?.slug === 'string' ? article.slug : '';
  return slugPattern.test(explicit) ? explicit : slugify(article?.title);
};

const attachVariants = ({ products, variants, categories = cloneSeedCategories() }) => {
  const variantsByProduct = new Map();
  for (const variant of variants) {
    const rows = variantsByProduct.get(variant.productId) ?? [];
    rows.push(variant);
    variantsByProduct.set(variant.productId, rows);
  }
  return products.map((product) => {
    const productVariants = variantsByProduct.get(product.id) ?? [];
    return { ...projectProductCategory(product, productVariants, categories), variants: productVariants };
  });
};

const normalizeSlug = (slug) => String(slug ?? '').trim().toLowerCase();

const historyTarget = ({ records, sourceSlug, currentBySlug, productById }) => {
  const visited = new Set();
  let slug = sourceSlug;
  while (true) {
    if (visited.has(slug)) return { cycle: true };
    visited.add(slug);
    const current = currentBySlug.get(slug);
    if (current) return { product: current };
    const record = records.find((entry) => entry.oldSlug === slug);
    if (!record || typeof record.newSlug !== 'string') return null;
    const product = productById.get(record.entityId);
    if (product?.slug === record.newSlug) return { product };
    slug = record.newSlug;
  }
};

const coverageEntries = (products) => {
  const bySlug = new Map();
  for (const product of products) {
    if (!['country', 'region', 'global'].includes(product.coverageType)) continue;
    const slugs = new Set([slugify(product.name), product.slug]);
    for (const coverageId of product.coverageIds ?? []) {
      const legacyDestinationSlug = String(coverageId).match(/^dest-(?:esim|sim)-du-lich-(.+)$/i)?.[1];
      if (legacyDestinationSlug) slugs.add(slugify(legacyDestinationSlug));
    }
    for (const slug of slugs) {
      if (!slug) continue;
      const displayName = slug === slugify(product.name)
        ? product.name
        : slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      const current = bySlug.get(slug) ?? {
        slug,
        name: displayName,
        type: product.coverageType === 'country' ? 'country' : 'region',
        products: [],
      };
      if (!current.products.some((candidate) => candidate.id === product.id)) current.products.push(product);
      bySlug.set(slug, current);
    }
  }
  return [...bySlug.values()].filter((entry) => entry.products.length > 0);
};

export const createPublicRouteResolver = ({
  catalogReader = createCanonicalCatalogReader(),
  slugHistoryRepository = createCatalogSlugHistoryRepository(),
  articleProvider = async () => [],
  now = () => new Date(),
} = {}) => {
  const readProducts = async () => {
    const catalog = await catalogReader.readCatalog();
    return attachVariants(catalog).filter((product) => product.operation !== 'topup' && getSeoVisibility(product, product.variants).public);
  };
  const readCoverage = async () => coverageEntries(await readProducts());
  const readArticles = async () => (await articleProvider())
    .filter((article) => isPublicArticle(article, now()) && getArticleSlug(article));

  return {
    async listProducts() { return readProducts(); },
    async listCoverage() { return readCoverage(); },
    async listArticles() { return readArticles(); },
    async resolveProductSlug(value) {
      const slug = normalizeSlug(value);
      if (!slugPattern.test(slug)) return { invalid: true };
      const products = await readProducts();
      const currentBySlug = new Map(products.map((product) => [product.slug, product]));
      const current = currentBySlug.get(slug);
      if (current) return { product: current, permanent: false };
      const history = await slugHistoryRepository.list();
      const result = historyTarget({ records: history, sourceSlug: slug, currentBySlug, productById: new Map(products.map((product) => [product.id, product])) });
      if (!result || result.cycle || !result.product) return { notFound: true, cycle: Boolean(result?.cycle) };
      return { redirect: getCanonicalProductPath(result.product), permanent: true, product: result.product };
    },
    async resolveCoverageSlug(value) {
      const slug = normalizeSlug(value);
      if (!slugPattern.test(slug)) return { invalid: true };
      const entry = (await readCoverage()).find((candidate) => candidate.slug === slug);
      return entry ? { coverage: entry } : { notFound: true };
    },
    async resolveArticleSlug(value) {
      const slug = normalizeSlug(value);
      if (!slugPattern.test(slug)) return { invalid: true };
      const article = (await readArticles()).find((candidate) => getArticleSlug(candidate) === slug);
      return article ? { article } : { notFound: true };
    },
  };
};
