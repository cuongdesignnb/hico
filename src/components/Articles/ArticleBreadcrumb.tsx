import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ArticleBreadcrumbItem } from './articleUtils';

export const ArticleBreadcrumb = ({ items }: { items: ArticleBreadcrumbItem[] }) => (
  <nav className="article-breadcrumb" aria-label="Breadcrumb">
    <ol>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <li key={`${item.path}-${item.name}`}>
            {isCurrent ? <span aria-current="page">{item.name}</span> : <Link to={item.path}>{item.name}</Link>}
            {!isCurrent && <ChevronRight size={15} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  </nav>
);
