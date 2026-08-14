import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getArticlePath } from '../../routing/canonicalRoute';
import { getArticleBySlug, getPublicArticles, type PublicArticle } from '../../services/publicSeoApi';
import { SeoHead } from '../../seo/SeoHead';
import { articleMetadata, defaultMetadata } from '../../seo/buildMetadata';
import { buildCanonicalUrl } from '../../seo/buildCanonicalUrl';
import { seoConfig } from '../../seo/seoConfig';
import { ArticleBreadcrumb } from './ArticleBreadcrumb';
import { ArticleCard } from './ArticleCard';
import { ArticleCategoryNav } from './ArticleCategoryNav';
import { ArticleDetailLayout } from './ArticleDetailLayout';
import { articleBreadcrumbSchema, getArticleCategories, getArticleCategoryLabel, type ArticleBreadcrumbItem } from './articleUtils';
import './Articles.css';

const Loading = () => <main id="main-content" tabIndex={-1} className="route-state" role="status">Loading content...</main>;
const NotFound = () => <main id="main-content" tabIndex={-1} className="route-state"><SeoHead path="/404" metadata={{ ...defaultMetadata(), title: 'Page not found | HICO eSIM', indexable: false }} noindex /><h1>Page not found</h1><p>The requested public content is unavailable.</p><Link to="/">Return home</Link></main>;

const toImageUrl = (image: string | undefined) => {
  const value = image || seoConfig.defaultImage;
  return /^https?:\/\//i.test(value) ? value : buildCanonicalUrl(value);
};

const articleSchema = (article: PublicArticle, path: string) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: article.title,
  description: article.seoDescription || article.content?.replace(/<[^>]*>/g, ' ').slice(0, 180) || article.title,
  image: toImageUrl(article.image),
  ...(article.createdAt ? { datePublished: article.createdAt } : {}),
  ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
  publisher: { '@type': 'Organization', name: seoConfig.siteName },
  mainEntityOfPage: buildCanonicalUrl(path),
});

const articleListBreadcrumbs: ArticleBreadcrumbItem[] = [
  { name: 'Trang chủ', path: '/' },
  { name: 'Bài viết', path: '/bai-viet' },
];

export const ArticleListPage = () => {
  const [articles, setArticles] = useState<PublicArticle[] | null>(null);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const controller = new AbortController();
    getPublicArticles(controller.signal).then(setArticles).catch(() => setArticles([]));
    return () => controller.abort();
  }, []);
  if (!articles) return <Loading />;

  const categories = getArticleCategories(articles);
  const requestedCategory = searchParams.get('category')?.trim() || '';
  const selectedCategory = categories.includes(requestedCategory) ? requestedCategory : '';
  const filteredArticles = selectedCategory
    ? articles.filter((article) => getArticleCategoryLabel(article) === selectedCategory)
    : articles;
  return (
    <main id="main-content" tabIndex={-1} className="public-page article-page">
      <SeoHead path="/bai-viet" metadata={{ ...defaultMetadata(), title: 'Travel guides | HICO eSIM', description: 'Travel and eSIM guides from HICO.' }} schema={articleBreadcrumbSchema(articleListBreadcrumbs)} />
      <div className="container article-list-shell">
        <ArticleBreadcrumb items={articleListBreadcrumbs} />
        <div className="page-heading"><p>HICO guides</p><h1>Articles</h1></div>
        <div className="article-list-grid">
          <aside className="article-sidebar"><ArticleCategoryNav articles={articles} categories={categories} selectedCategory={selectedCategory} /></aside>
          <section aria-labelledby="article-list-title">
            <div className="article-list-heading"><h2 id="article-list-title">{selectedCategory || 'Tất cả bài viết'}</h2><span>{filteredArticles.length} bài viết</span></div>
            {filteredArticles.length ? <div className="article-card-grid">{filteredArticles.map((article) => <ArticleCard key={article.id} article={article} />)}</div> : <div className="route-state compact"><h2>Chưa có bài viết trong danh mục này.</h2></div>}
          </section>
        </div>
      </div>
    </main>
  );
};

export const ArticlePage = () => {
  const { slug = '' } = useParams();
  const [articleResult, setArticleResult] = useState<{ slug: string; article: PublicArticle | null } | null>(null);
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    getArticleBySlug(slug, controller.signal).then((value) => setArticleResult({ slug, article: value })).catch(() => setArticleResult({ slug, article: null }));
    getPublicArticles(controller.signal).then(setArticles).catch(() => setArticles([]));
    return () => controller.abort();
  }, [slug]);
  if (!articleResult || articleResult.slug !== slug) return <Loading />;
  const article = articleResult.article;
  if (!article) return <NotFound />;

  const path = getArticlePath(article);
  const category = article.category?.trim();
  const breadcrumbItems: ArticleBreadcrumbItem[] = [
    { name: 'Trang chủ', path: '/' },
    { name: 'Bài viết', path: '/bai-viet' },
    ...(category ? [{ name: category, path: `/bai-viet?category=${encodeURIComponent(category)}` }] : []),
    { name: article.title, path },
  ];
  const relatedArticles = articles.some((item) => item.id === article.id) ? articles : [article, ...articles];
  return (
    <>
      <SeoHead path={path} metadata={articleMetadata(article)} schema={{ '@context': 'https://schema.org', '@graph': [articleBreadcrumbSchema(breadcrumbItems), articleSchema(article, path)] }} />
      <ArticleDetailLayout article={article} articles={relatedArticles} breadcrumbItems={breadcrumbItems} />
    </>
  );
};
