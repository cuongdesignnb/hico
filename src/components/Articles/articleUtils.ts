import type { PublicArticle } from '../../services/publicSeoApi';
import { buildCanonicalUrl } from '../../seo/buildCanonicalUrl';

export interface ArticleBreadcrumbItem {
  name: string;
  path: string;
}

export const uncategorizedArticleLabel = 'Chưa phân loại';

export const getArticleCategoryLabel = (article: PublicArticle): string => article.category?.trim() || uncategorizedArticleLabel;

export const articleBreadcrumbSchema = (items: ArticleBreadcrumbItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: buildCanonicalUrl(item.path),
  })),
});

export const getArticleCategories = (articles: PublicArticle[]): string[] => [...new Set(
  articles.map(getArticleCategoryLabel),
)].sort((left, right) => left.localeCompare(right, 'vi'));
