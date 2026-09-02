import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Package, Tags } from 'lucide-react';
import type { CatalogProductRecord } from '../../../types/catalog';

interface ProductStatsCardsProps {
  products: CatalogProductRecord[];
}

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

const ProductStatsCards = ({ products }: ProductStatsCardsProps) => {
  const stats = useMemo(() => {
    let activeCount = 0;
    let reviewCount = 0;
    let totalVariants = 0;

    products.forEach((product) => {
      if (product.status === 'active') activeCount += 1;
      totalVariants += product.variants.length;
      reviewCount += product.variants.filter((v) => v.needsReview).length;
    });

    return {
      total: products.length,
      active: activeCount,
      totalVariants,
      review: reviewCount,
    };
  }, [products]);

  return (
    <div className="catalog-kpi-grid" aria-label="Tổng quan sản phẩm">
      <div className="catalog-kpi-card catalog-kpi-card--primary">
        <div className="catalog-kpi-card__icon">
          <Package size={20} />
        </div>
        <div className="catalog-kpi-card__body">
          <span className="catalog-kpi-card__label">Tổng sản phẩm</span>
          <strong className="catalog-kpi-card__value">{formatNumber(stats.total)}</strong>
          <span className="catalog-kpi-card__sub">Toàn bộ danh mục</span>
        </div>
      </div>

      <div className="catalog-kpi-card catalog-kpi-card--success">
        <div className="catalog-kpi-card__icon">
          <CheckCircle2 size={20} />
        </div>
        <div className="catalog-kpi-card__body">
          <span className="catalog-kpi-card__label">Đang bán</span>
          <strong className="catalog-kpi-card__value">{formatNumber(stats.active)}</strong>
          <span className="catalog-kpi-card__sub">
            {stats.total > 0
              ? `${Math.round((stats.active / stats.total) * 100)}% tổng sản phẩm`
              : 'Chưa có dữ liệu'}
          </span>
        </div>
      </div>

      <div className="catalog-kpi-card catalog-kpi-card--info">
        <div className="catalog-kpi-card__icon">
          <Tags size={20} />
        </div>
        <div className="catalog-kpi-card__body">
          <span className="catalog-kpi-card__label">Tổng variants</span>
          <strong className="catalog-kpi-card__value">{formatNumber(stats.totalVariants)}</strong>
          <span className="catalog-kpi-card__sub">Gói bán trong catalog</span>
        </div>
      </div>

      <div className="catalog-kpi-card catalog-kpi-card--warning">
        <div className="catalog-kpi-card__icon">
          <AlertTriangle size={20} />
        </div>
        <div className="catalog-kpi-card__body">
          <span className="catalog-kpi-card__label">Cần review</span>
          <strong className="catalog-kpi-card__value">{formatNumber(stats.review)}</strong>
          <span className="catalog-kpi-card__sub">
            {stats.review > 0 ? 'Cần xác nhận nguồn' : 'Không có cảnh báo'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductStatsCards;
