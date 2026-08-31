import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ProductDetail } from '../components/ProductDetail/ProductDetail';
import { ProductNotFound } from '../components/ProductDetail/ProductNotFound';
import { usePublicProductBySlug } from '../hooks/catalog/usePublicProductBySlug';
import { productMetadata } from '../seo/buildMetadata';
import { SeoHead } from '../seo/SeoHead';
import { getCanonicalProductPath } from '../routing/canonicalRoute';
import { buildCanonicalUrl } from '../seo/buildCanonicalUrl';

const productSchema = (product: Parameters<typeof ProductDetail>[0]['product']) => {
  const prices = product.variants.map((variant) => variant.price).filter(Number.isFinite);
  const currencies = [...new Set(product.variants.map((variant) => variant.currency))];
  const offers = prices.length && currencies.length === 1 ? { '@type': 'AggregateOffer', priceCurrency: currencies[0], lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length } : undefined;
  return { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.seo.description || product.name, image: product.images, sku: product.variants[0]?.sku, url: buildCanonicalUrl(getCanonicalProductPath(product)), ...(offers ? { offers } : {}) };
};

export const ProductDetailPage = () => {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { product, error, redirect, reload } = usePublicProductBySlug(slug);
  const errorStatus = (error as (Error & { status?: number }) | null)?.status;
  useEffect(() => { if (redirect) navigate(redirect, { replace: true }); }, [navigate, redirect]);
  const canonicalPath = product ? getCanonicalProductPath(product) : null;
  useEffect(() => { if (canonicalPath && location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true }); }, [canonicalPath, location.pathname, navigate]);
  if (product === undefined && !error) return <main className="route-state" role="status">Đang tải thông tin sản phẩm...</main>;
  if (redirect) return <main className="route-state" role="status">Đang chuyển tới sản phẩm hiện tại...</main>;
  if (error && errorStatus === 404) return <ProductNotFound />;
  if (error) return <main className="route-state"><h1>Không thể tải thông tin sản phẩm</h1><p>Hãy thử lại sau giây lát.</p><button type="button" onClick={reload}>Thử lại</button><Link to="/san-pham">Quay lại danh mục</Link></main>;
  if (!product) return <ProductNotFound />;
  const path = canonicalPath ?? getCanonicalProductPath(product);
  if (location.pathname !== path) return <main className="route-state" role="status">Đang chuyển tới sản phẩm hiện tại...</main>;
  return <main id="main-content" tabIndex={-1}><SeoHead path={path} metadata={productMetadata(product)} schema={{ '@context': 'https://schema.org', '@graph': [{ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Trang chủ', item: buildCanonicalUrl('/') }, { '@type': 'ListItem', position: 2, name: product.name, item: buildCanonicalUrl(path) }] }, productSchema(product)] }} /><ProductDetail product={product} /></main>;
};
