import { getArticleSlug, getCanonicalProductPath } from './publicRouteResolver.js';

const xmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const normalizedOrigin = (value) => String(value ?? '').replace(/\/$/, '');

export const createSitemapXml = ({ siteUrl, products, coverage, articles }) => {
  const origin = normalizedOrigin(siteUrl);
  const rows = [
    { path: '/', lastmod: null },
    { path: '/san-pham', lastmod: null },
    { path: '/diem-den', lastmod: null },
    { path: '/bai-viet', lastmod: null },
    ...products.map((product) => ({ path: getCanonicalProductPath(product), lastmod: product.updatedAt ?? product.createdAt ?? null })),
    ...coverage.map((entry) => ({ path: entry.type === 'country' ? `/diem-den/${entry.slug}` : `/khu-vuc/${entry.slug}`, lastmod: null })),
    ...articles.map((article) => ({ path: `/bai-viet/${getArticleSlug(article)}`, lastmod: article.updatedAt ?? article.createdAt ?? null })),
  ];
  const unique = [...new Map(rows.map((row) => [row.path, row])).values()];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map((row) => `  <url><loc>${xmlEscape(`${origin}${row.path}`)}</loc>${row.lastmod && !Number.isNaN(Date.parse(row.lastmod)) ? `<lastmod>${new Date(row.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
};
