import type { CatalogProductRecord } from '../types/catalog';

export interface CoveragePage {
  slug: string;
  name: string;
  type: 'country' | 'region';
  products: CatalogProductRecord[];
}

export interface PublicArticle {
  id: string;
  slug?: string;
  title: string;
  date?: string;
  image?: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: 'published' | 'draft' | 'scheduled';
  scheduledDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

const getError = async (response: Response): Promise<Error> => {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(payload?.error || 'Content is unavailable.');
};

const request = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw await getError(response);
  return response.json() as Promise<T>;
};

export const getPublicProducts = (signal?: AbortSignal) => request<CatalogProductRecord[]>('/api/catalog/products', signal);
export const getProductBySlug = (slug: string, signal?: AbortSignal) => request<CatalogProductRecord | { redirect: string; permanent: true }>(`/api/catalog/products/by-slug/${encodeURIComponent(slug)}`, signal);
export const getCoverageBySlug = (slug: string, signal?: AbortSignal) => request<CoveragePage>(`/api/catalog/coverage/by-slug/${encodeURIComponent(slug)}`, signal);
export const getPublicArticles = (signal?: AbortSignal) => request<PublicArticle[]>('/api/articles', signal);
export const getArticleBySlug = (slug: string, signal?: AbortSignal) => request<PublicArticle>(`/api/articles/by-slug/${encodeURIComponent(slug)}`, signal);
