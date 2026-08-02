import { getCanonicalProductPath } from './canonicalRoute';
import type { CatalogProductRecord } from '../types/catalog';

const simpleRoutes: Record<string, string> = {
  '#/': '/',
  '#/home': '/',
  '#/dashboard': '/tai-khoan',
  '#/admin': '/quan-tri',
  '#/cart': '/gio-hang',
  '#/checkout': '/thanh-toan',
};

export const redirectLegacyHash = async (): Promise<boolean> => {
  const hash = window.location.hash;
  if (!hash) return false;
  const simple = simpleRoutes[hash];
  if (simple) {
    window.location.replace(simple);
    return true;
  }
  const productMatch = /^#\/product\/([^/?#]+)$/.exec(hash);
  if (!productMatch) {
    window.location.replace('/404');
    return true;
  }
  try {
    const response = await fetch(`/api/catalog/products/${encodeURIComponent(productMatch[1])}`);
    if (!response.ok) throw new Error('Legacy product is not public.');
    const product = await response.json() as CatalogProductRecord;
    window.location.replace(getCanonicalProductPath(product));
  } catch {
    window.location.replace('/404');
  }
  return true;
};
