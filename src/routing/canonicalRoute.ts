import type { CatalogProduct } from '../types/catalog';

export const getCanonicalProductPath = (product: Pick<CatalogProduct, 'operation' | 'slug'>): string => {
  if (product.operation === 'topup') return `/nap-them/${product.slug}`;
  if (product.operation === 'device_sale') return `/thiet-bi/${product.slug}`;
  return `/san-pham/${product.slug}`;
};

export const slugify = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const getArticlePath = (article: { slug?: string; title: string }): string => (
  `/bai-viet/${article.slug || slugify(article.title)}`
);
