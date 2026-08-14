import { Link } from 'react-router-dom';
import { getArticlePath } from '../../routing/canonicalRoute';
import type { PublicArticle } from '../../services/publicSeoApi';
import { getArticleCategoryLabel } from './articleUtils';

interface ArticleRelatedListProps {
  article: PublicArticle;
  articles: PublicArticle[];
}

export const ArticleRelatedList = ({ article, articles }: ArticleRelatedListProps) => {
  const category = getArticleCategoryLabel(article);
  const candidates = articles.filter((item) => item.id !== article.id);
  const related = [
    ...candidates.filter((item) => getArticleCategoryLabel(item) === category),
    ...candidates.filter((item) => getArticleCategoryLabel(item) !== category),
  ].slice(0, 4);

  if (!related.length) return null;
  return (
    <section className="article-related" aria-labelledby="article-related-title">
      <h2 id="article-related-title">Bài viết liên quan</h2>
      <div className="article-related-list">
        {related.map((item) => (
          <Link key={item.id} to={getArticlePath(item)}>
            <span>{getArticleCategoryLabel(item)}</span>
            <strong>{item.title}</strong>
            {item.date && <time>{item.date}</time>}
          </Link>
        ))}
      </div>
    </section>
  );
};
