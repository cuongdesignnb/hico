import type { PublicProduct } from '../types/publicCatalog';
import { getPublicProductBySlug as getCanonicalProductBySlug, getPublicProducts as getCanonicalProducts } from './publicCatalogApi';

export interface CoveragePage {
  slug: string;
  name: string;
  type: 'country' | 'region';
  products: PublicProduct[];
}

export interface PublicArticle {
  id: string;
  slug?: string;
  title: string;
  category?: string;
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

export const getPublicProducts = (signal?: AbortSignal) => getCanonicalProducts({}, signal);
export const getProductBySlug = (slug: string, signal?: AbortSignal) => getCanonicalProductBySlug(slug, signal);
export const getCoverageBySlug = (slug: string, signal?: AbortSignal) => request<CoveragePage>(`/api/catalog/coverage/by-slug/${encodeURIComponent(slug)}`, signal);
export const getPublicArticles = (signal?: AbortSignal) => request<PublicArticle[]>('/api/articles', signal);
export const getArticleBySlug = (slug: string, signal?: AbortSignal) => request<PublicArticle>(`/api/articles/by-slug/${encodeURIComponent(slug)}`, signal);
