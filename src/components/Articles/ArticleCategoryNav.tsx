import { Link } from 'react-router-dom';
import type { PublicArticle } from '../../services/publicSeoApi';
import { getArticleCategoryLabel } from './articleUtils';

const categoryPath = (category: string) => `/bai-viet?category=${encodeURIComponent(category)}`;

interface ArticleCategoryNavProps {
  articles: PublicArticle[];
  categories: string[];
  selectedCategory?: string;
  heading?: string;
}

export const ArticleCategoryNav = ({ articles, categories, selectedCategory = '', heading = 'Danh mục bài viết' }: ArticleCategoryNavProps) => {
  if (!categories.length) return null;
  return (
    <nav className="article-category-nav" aria-label={heading}>
      <h2>{heading}</h2>
      <ul>
        <li>
          <Link className={!selectedCategory ? 'is-active' : ''} to="/bai-viet" aria-current={!selectedCategory ? 'page' : undefined}>
            <span>Tất cả bài viết</span>
            <span>{articles.length}</span>
          </Link>
        </li>
        {categories.map((category) => {
          const count = articles.filter((article) => getArticleCategoryLabel(article) === category).length;
          const isActive = selectedCategory === category;
          return (
            <li key={category}>
              <Link className={isActive ? 'is-active' : ''} to={categoryPath(category)} aria-current={isActive ? 'page' : undefined}>
                <span>{category}</span>
                <span>{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
