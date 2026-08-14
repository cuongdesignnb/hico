import { Link } from 'react-router-dom';
import { getArticlePath } from '../../routing/canonicalRoute';
import { seoConfig } from '../../seo/seoConfig';
import type { PublicArticle } from '../../services/publicSeoApi';
import { getArticleCategoryLabel } from './articleUtils';

export const ArticleCard = ({ article }: { article: PublicArticle }) => {
  const category = getArticleCategoryLabel(article);
  return (
    <Link className="article-card" to={getArticlePath(article)}>
      <img src={article.image || seoConfig.defaultImage} alt={article.title} loading="lazy" />
      <div className="article-card-body">
        <span className="article-card-category">{category}</span>
        <h2>{article.title}</h2>
        {article.date && <time>{article.date}</time>}
      </div>
    </Link>
  );
};
