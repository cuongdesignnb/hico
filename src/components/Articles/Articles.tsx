import React, { useState, useEffect } from 'react';
import { ArrowRight, Calendar } from 'lucide-react';
import './Articles.css';

export interface Article {
  id: string;
  title: string;
  date: string;
  image: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  status?: 'published' | 'draft' | 'scheduled';
  scheduledDate?: string;
}

const FALLBACK_ARTICLES: Article[] = [
  {
    id: 'art-1',
    title: 'eSIM là gì? Hướng dẫn chi tiết cho người mới bắt đầu',
    date: '12 Tháng 5, 2024',
    image: '/images/art_esim_intro.png',
  },
  {
    id: 'art-2',
    title: '10 mẹo sử dụng eSIM khi du lịch nước ngoài',
    date: '28 Tháng 4, 2024',
    image: '/images/art_travel_tips.png',
  },
  {
    id: 'art-3',
    title: 'So sánh eSIM và SIM vật lý: Nên chọn loại nào?',
    date: '15 Tháng 4, 2024',
    image: '/images/art_sim_compare.png',
  },
];

interface ArticlesProps {
  onSelectArticle?: (article: Article) => void;
}

export const Articles: React.FC<ArticlesProps> = ({ onSelectArticle }) => {
  const [articles, setArticles] = useState<Article[]>(FALLBACK_ARTICLES);

  useEffect(() => {
    fetch('/api/articles')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Server error');
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setArticles(data);
        }
      })
      .catch(() => {
        // Fallback silently
      });
  }, []);

  return (
    <div className="articles-block">
      {/* Header */}
      <div className="section-title-wrapper no-margin-bottom">
        <div>
          <h2 className="section-title">Bài viết hữu ích</h2>
        </div>
        <a href="#" className="section-view-all" onClick={(e) => e.preventDefault()}>
          Xem tất cả <ArrowRight size={16} />
        </a>
      </div>
      <p className="articles-block-subtitle">Cẩm nang du lịch và công nghệ</p>

      {/* List Layout */}
      <div className="articles-vertical-list">
        {articles.slice(0, 3).map((art) => (
          <article 
            key={art.id} 
            className="mini-article-card" 
            onClick={() => onSelectArticle && onSelectArticle(art)}
          >
            {/* Left Thumbnail Image */}
            <div className="mini-art-image-box">
              <img
                src={art.image}
                alt={art.title}
                className="mini-art-image"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).onerror = null;
                  (e.target as HTMLImageElement).src = '/images/art_esim_intro.png';
                }}
              />
            </div>

            {/* Right Content */}
            <div className="mini-art-content">
              <h3 className="mini-art-title">{art.title}</h3>
              <div className="mini-art-date-row">
                <Calendar size={10} className="mini-art-cal-icon" />
                <span>{art.date}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

