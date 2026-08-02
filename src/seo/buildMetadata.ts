import type { CatalogProductRecord } from '../types/catalog';
import type { PublicArticle } from '../services/publicSeoApi';
import { seoConfig } from './seoConfig';

const plainText = (value?: string) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export interface Metadata {
  title: string;
  description: string;
  image: string;
  indexable: boolean;
}

export const defaultMetadata = (): Metadata => ({
  title: seoConfig.defaultTitle,
  description: seoConfig.defaultDescription,
  image: seoConfig.defaultImage,
  indexable: true,
});

export const productMetadata = (product: CatalogProductRecord): Metadata => ({
  title: product.seoTitle || `${product.name} | ${seoConfig.siteName}`,
  description: product.seoDescription || plainText(product.description || product.guide) || `Explore ${product.name} with ${seoConfig.siteName}.`,
  image: product.image || seoConfig.defaultImage,
  indexable: true,
});

export const articleMetadata = (article: PublicArticle): Metadata => ({
  title: article.seoTitle || `${article.title} | ${seoConfig.siteName}`,
  description: article.seoDescription || plainText(article.content) || `Read ${article.title} from ${seoConfig.siteName}.`,
  image: article.image || seoConfig.defaultImage,
  indexable: true,
});
