import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';
import { getArticlePath } from '../../routing/canonicalRoute';
import { getPublicArticles, type PublicArticle } from '../../services/publicSeoApi';
import './Articles.css';

export type Article = PublicArticle;

export const Articles: React.FC = () => {
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    getPublicArticles(controller.signal).then(setArticles).catch(() => setArticles([]));
    return () => controller.abort();
  }, []);
  return <div className="articles-block">
    <div className="section-title-wrapper no-margin-bottom"><div><h2 className="section-title">Bai viet huu ich</h2></div><Link to="/bai-viet" className="section-view-all">Xem tat ca <ArrowRight size={16} /></Link></div>
    <p className="articles-block-subtitle">Cam nang du lich va cong nghe</p>
    <div className="articles-vertical-list">{articles.slice(0, 3).map((article) => <Link key={article.id} className="mini-article-card" to={getArticlePath(article)}><div className="mini-art-image-box"><img src={article.image || '/images/art_esim_intro.png'} alt={article.title} className="mini-art-image" loading="lazy" /></div><div className="mini-art-content"><h3 className="mini-art-title">{article.title}</h3><div className="mini-art-date-row"><Calendar size={10} className="mini-art-cal-icon" /><span>{article.date}</span></div></div></Link>)}</div>
  </div>;
};
