import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanonicalCatalogReader } from '../server/catalog/canonical/canonicalCatalogReader.js';
import { createCanonicalCatalogRepository } from '../server/catalog/canonical/canonicalCatalogRepository.js';
import { createCatalogSlugHistoryRepository } from '../server/catalog/write/catalogSlugHistoryRepository.js';
import { createPublicRouteResolver, getArticleSlug, getCanonicalProductPath } from '../server/seo/publicRouteResolver.js';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(rootDirectory, 'dist');
const uploadsDirectory = path.join(rootDirectory, 'server', 'uploads');
const siteUrl = String(process.env.PUBLIC_SITE_URL ?? process.env.VITE_PUBLIC_SITE_URL ?? 'https://example.com').replace(/\/$/, '');
const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plainText = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const absoluteUrl = (value) => /^https?:\/\//i.test(value) ? value : `${siteUrl}${value?.startsWith('/') ? value : `/${value ?? ''}`}`;

const metadataFor = ({ title, description, image, path: route, type = 'website' }) => ({
  title: title || 'HICO eSIM - Kết nối toàn cầu không giới hạn',
  description: description || 'Nhanh chóng, dễ dàng và tin cậy tại 200+ quốc gia. Không cần SIM vật lý, không roaming, chỉ cần quét và kết nối.',
  image: absoluteUrl(image || '/images/art_travel_tips.png'),
  canonical: `${siteUrl}${route === '/' ? '' : route}`,
  type,
});

const render = (template, metadata) => {
  const head = [
    `<link rel="canonical" href="${escapeHtml(metadata.canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(metadata.title)}">`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}">`,
    `<meta property="og:url" content="${escapeHtml(metadata.canonical)}">`,
    `<meta property="og:type" content="${metadata.type}">`,
    `<meta property="og:image" content="${escapeHtml(metadata.image)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(metadata.image)}">`,
  ].join('\n    ');
  return template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(metadata.description)}" />`)
    .replace('</head>', `    ${head}\n  </head>`);
};

const main = async () => {
  const template = await readFile(path.join(distDirectory, 'index.html'), 'utf8');
  const articleProvider = async () => JSON.parse(await readFile(path.join(uploadsDirectory, 'articles.json'), 'utf8'));
  const resolver = createPublicRouteResolver({
    catalogReader: createCanonicalCatalogReader({ env: { CATALOG_READ_SOURCE: 'canonical', CATALOG_CANONICAL_FALLBACK: 'false' } }),
    slugHistoryRepository: createCatalogSlugHistoryRepository({ recordsFile: path.join(uploadsDirectory, 'catalog_slug_history.json') }),
    articleProvider,
  });
  const [products, coverage, articles] = await Promise.all([resolver.listProducts(), resolver.listCoverage(), resolver.listArticles()]);
  const routes = [
    { path: '/', metadata: metadataFor({ path: '/' }) },
    { path: '/san-pham', metadata: metadataFor({ path: '/san-pham', title: 'Travel eSIM packages | HICO eSIM', description: 'Browse public HICO travel eSIM packages.' }) },
    { path: '/diem-den', metadata: metadataFor({ path: '/diem-den', title: 'Destinations | HICO eSIM', description: 'Explore public HICO eSIM destinations.' }) },
    { path: '/bai-viet', metadata: metadataFor({ path: '/bai-viet', title: 'Travel guides | HICO eSIM', description: 'Travel and eSIM guides from HICO.' }) },
    ...products.map((product) => ({ path: getCanonicalProductPath(product), metadata: metadataFor({ path: getCanonicalProductPath(product), title: product.seoTitle || `${product.name} | HICO eSIM`, description: product.seoDescription || plainText(product.description || product.guide), image: product.image, type: 'product' }) })),
    ...coverage.map((entry) => {
      const route = entry.type === 'country' ? `/diem-den/${entry.slug}` : `/khu-vuc/${entry.slug}`;
      return { path: route, metadata: metadataFor({ path: route, title: `${entry.name} | HICO eSIM`, description: `Public HICO packages for ${entry.name}.` }) };
    }),
    ...articles.map((article) => {
      const route = `/bai-viet/${getArticleSlug(article)}`;
      return { path: route, metadata: metadataFor({ path: route, title: article.seoTitle || `${article.title} | HICO eSIM`, description: article.seoDescription || plainText(article.content), image: article.image, type: 'article' }) };
    }),
  ];
  if (products.some((product) => product.operation === 'topup')) routes.push({ path: '/nap-them', metadata: metadataFor({ path: '/nap-them', title: 'Top-up packages | HICO eSIM', description: 'Browse public HICO top-up packages.' }) });
  if (products.some((product) => product.operation === 'device_sale')) routes.push({ path: '/thiet-bi', metadata: metadataFor({ path: '/thiet-bi', title: '4G / 5G devices | HICO eSIM', description: 'Browse public HICO mobile devices.' }) });
  const uniqueRoutes = [...new Map(routes.map((route) => [route.path, route])).values()];
  for (const route of uniqueRoutes) {
    const output = route.path === '/'
      ? path.join(distDirectory, 'index.html')
      : path.join(distDirectory, `${route.path.slice(1)}.html`);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, render(template, route.metadata), 'utf8');
  }
  const manifest = await createCanonicalCatalogRepository().readCurrentManifest();
  const catalogVersionId = manifest?.versionId ?? manifest?.migrationId ?? null;
  await writeFile(path.join(distDirectory, 'prerender-manifest.json'), `${JSON.stringify({ catalogVersionId, generatedAt: new Date().toISOString(), routes: uniqueRoutes.map((route) => route.path) }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ generated: uniqueRoutes.length, catalogVersionId }));
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
