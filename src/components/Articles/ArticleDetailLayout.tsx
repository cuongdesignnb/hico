import type { PublicArticle } from '../../services/publicSeoApi';
import { ArticleBreadcrumb } from './ArticleBreadcrumb';
import { ArticleCategoryNav } from './ArticleCategoryNav';
import { ArticleRelatedList } from './ArticleRelatedList';
import { getArticleCategories, getArticleCategoryLabel, type ArticleBreadcrumbItem } from './articleUtils';

const sanitizeHtml = (html: string) => {
  const documentFragment = new DOMParser().parseFromString(html, 'text/html');
  documentFragment.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove());
  documentFragment.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (
        attribute.name.startsWith('on')
        || (attribute.name === 'href' && !/^(https?:|mailto:|\/)/i.test(attribute.value))
        || (attribute.name === 'src' && !/^(https?:|\/)/i.test(attribute.value))
      ) element.removeAttribute(attribute.name);
    });
  });
  return documentFragment.body.innerHTML;
};

interface ArticleDetailLayoutProps {
  article: PublicArticle;
  articles: PublicArticle[];
  breadcrumbItems: ArticleBreadcrumbItem[];
}

export const ArticleDetailLayout = ({ article, articles, breadcrumbItems }: ArticleDetailLayoutProps) => {
  const categories = getArticleCategories(articles);
  const category = getArticleCategoryLabel(article);
  return (
    <main id="main-content" tabIndex={-1} className="public-page article-page">
      <div className="container article-detail-shell">
        <ArticleBreadcrumb items={breadcrumbItems} />
        <div className="article-detail-grid">
          <article className="article-detail-main">
            <header className="article-detail-header">
              {category && <span className="article-detail-category">{category}</span>}
              {article.date && <time>{article.date}</time>}
              <h1>{article.title}</h1>
            </header>
            {article.image && <img className="article-detail-image" src={article.image} alt={article.title} />}
            {article.content?.trim() ? (
              <div className="article-rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }} />
            ) : (
              <p className="article-empty-content">Nội dung bài viết đang được cập nhật.</p>
            )}
          </article>
          <aside className="article-sidebar">
            <ArticleCategoryNav articles={articles} categories={categories} selectedCategory={category} />
            <ArticleRelatedList article={article} articles={articles} />
          </aside>
        </div>
      </div>
    </main>
  );
};
