import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { ProductDetail } from '../components/ProductDetail/ProductDetail';
import { getArticlePath, getCanonicalProductPath } from '../routing/canonicalRoute';
import { getArticleBySlug, getCoverageBySlug, getPublicArticles, getPublicProducts, getPublicProductBySlug, type PublicArticle } from '../services/publicSeoApi';
import type { CatalogProductRecord } from '../types/catalog';
import type { PublicProduct } from '../types/publicCatalog';
import { SeoHead } from '../seo/SeoHead';
import { articleMetadata, defaultMetadata, productMetadata } from '../seo/buildMetadata';
import { buildCanonicalUrl } from '../seo/buildCanonicalUrl';
import { seoConfig } from '../seo/seoConfig';
import './publicPages.css';

const breadcrumbSchema = (items: { name: string; path: string }[]) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: buildCanonicalUrl(item.path) })) });
const productSchema = (product: PublicProduct, path: string) => {
  const visible = product.variants.filter((variant) => variant.active);
  const currencies = [...new Set(visible.map((variant) => variant.currency))];
  const prices = visible.map((variant) => variant.price).filter(Number.isFinite);
  const offers = currencies.length === 1 && prices.length ? { '@type': 'AggregateOffer', priceCurrency: currencies[0], lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length } : undefined;
  return { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.seoDescription || product.description || product.guide || product.name, image: toImageUrl(product.image), sku: visible[0]?.sku, brand: { '@type': 'Brand', name: 'HICO' }, url: buildCanonicalUrl(path), ...(offers ? { offers } : {}) };
};
const toImageUrl = (image: string | undefined) => {
  const value = image || seoConfig.defaultImage;
  return /^https?:\/\//i.test(value) ? value : buildCanonicalUrl(value);
};
const articleSchema = (article: PublicArticle, path: string) => ({ '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.seoDescription || article.content?.replace(/<[^>]*>/g, ' ').slice(0, 180) || article.title, image: toImageUrl(article.image), ...(article.createdAt ? { datePublished: article.createdAt } : {}), ...(article.updatedAt ? { dateModified: article.updatedAt } : {}), publisher: { '@type': 'Organization', name: seoConfig.siteName }, mainEntityOfPage: buildCanonicalUrl(path) });

const Loading = () => <main id="main-content" tabIndex={-1} className="route-state" role="status">Loading content...</main>;
const NotFound = () => <main id="main-content" tabIndex={-1} className="route-state"><SeoHead path="/404" metadata={{ ...defaultMetadata(), title: 'Page not found | HICO eSIM', indexable: false }} noindex /><h1>Page not found</h1><p>The requested public content is unavailable.</p><Link to="/">Return home</Link></main>;

const ProductCard = ({ product }: { product: CatalogProductRecord }) => {
  const prices = product.variants.map((variant) => variant.price).filter(Number.isFinite);
  return <Link to={getCanonicalProductPath(product)} className="public-product-card"><img src={product.image || seoConfig.defaultImage} alt={product.name} loading="lazy" /><div><h2>{product.name}</h2><p>{product.coverageType === 'country' ? 'Destination eSIM' : 'Regional connectivity'}</p><strong>{prices.length ? `From ${Math.min(...prices).toLocaleString('vi-VN')} ${product.variants[0]?.currency || 'VND'}` : 'View package'}</strong></div></Link>;
};

export const ProductListPage = ({ operation }: { operation?: CatalogProductRecord['operation'] }) => {
  const { searchQuery } = useApp();
  const [products, setProducts] = useState<CatalogProductRecord[] | null>(null);
  useEffect(() => { const controller = new AbortController(); getPublicProducts(controller.signal).then(setProducts).catch(() => setProducts([])); return () => controller.abort(); }, []);
  if (products === null) return <Loading />;
  const filtered = products.filter((product) => (!operation || product.operation === operation) && product.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const path = operation === 'topup' ? '/nap-them' : operation === 'device_sale' ? '/thiet-bi' : '/san-pham';
  const heading = operation === 'topup' ? 'Top-up packages' : operation === 'device_sale' ? '4G / 5G devices' : 'Travel eSIM packages';
  return <main id="main-content" tabIndex={-1} className="public-page"><SeoHead path={path} metadata={{ ...defaultMetadata(), title: `${heading} | HICO eSIM`, description: `Browse ${heading.toLowerCase()} from HICO.` }} /><div className="container"><div className="page-heading"><p>HICO catalog</p><h1>{heading}</h1></div>{filtered.length ? <div className="public-card-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="route-state compact"><h2>No public packages are available yet.</h2></div>}</div></main>;
};

export const ProductPage = () => {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<PublicProduct | null | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    getPublicProductBySlug(slug, controller.signal).then((result) => {
      if ('redirect' in result) navigate(result.redirect, { replace: true });
      else setProduct(result);
    }).catch(() => setProduct(null));
    return () => controller.abort();
  }, [navigate, slug]);
  if (product === undefined) return <Loading />;
  if (!product) return <NotFound />;
  const path = getCanonicalProductPath(product);
  return <main id="main-content" tabIndex={-1}><SeoHead path={path} metadata={productMetadata(product)} schema={{ '@context': 'https://schema.org', '@graph': [breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Products', path: '/san-pham' }, { name: product.name, path }]), productSchema(product, path)] }} /><ProductDetail product={product} /></main>;
};

export const CoverageListPage = () => {
  const [products, setProducts] = useState<CatalogProductRecord[] | null>(null);
  useEffect(() => { const controller = new AbortController(); getPublicProducts(controller.signal).then(setProducts).catch(() => setProducts([])); return () => controller.abort(); }, []);
  if (!products) return <Loading />;
  const countries = products.filter((product) => product.coverageType === 'country');
  return <main id="main-content" tabIndex={-1} className="public-page"><SeoHead path="/diem-den" metadata={{ ...defaultMetadata(), title: 'Destinations | HICO eSIM', description: 'Explore public HICO eSIM destinations.' }} /><div className="container"><div className="page-heading"><p>Destination guide</p><h1>Destinations</h1></div><div className="public-card-grid">{countries.map((product) => <Link key={product.id} className="public-product-card" to={`/diem-den/${product.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`}><img src={product.image || seoConfig.defaultImage} alt={product.name} /><div><h2>{product.name}</h2><p>Explore packages for this destination.</p></div></Link>)}</div></div></main>;
};

export const CoveragePage = ({ expectedType }: { expectedType: 'country' | 'region' }) => {
  const { slug = '' } = useParams();
  const [coverage, setCoverage] = useState<Awaited<ReturnType<typeof getCoverageBySlug>> | null | undefined>(undefined);
  useEffect(() => { const controller = new AbortController(); getCoverageBySlug(slug, controller.signal).then(setCoverage).catch(() => setCoverage(null)); return () => controller.abort(); }, [slug]);
  if (coverage === undefined) return <Loading />;
  if (!coverage || coverage.type !== expectedType) return <NotFound />;
  const path = expectedType === 'country' ? `/diem-den/${coverage.slug}` : `/khu-vuc/${coverage.slug}`;
  return <main id="main-content" tabIndex={-1} className="public-page"><SeoHead path={path} metadata={{ ...defaultMetadata(), title: `${coverage.name} | HICO eSIM`, description: `Public packages for ${coverage.name}.` }} schema={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: expectedType === 'country' ? 'Destinations' : 'Regions', path: expectedType === 'country' ? '/diem-den' : '/san-pham' }, { name: coverage.name, path }])} /><div className="container"><div className="page-heading"><p>{expectedType === 'country' ? 'Destination' : 'Region'}</p><h1>{coverage.name}</h1></div><div className="public-card-grid">{coverage.products.map((product) => <ProductCard key={product.id} product={product} />)}</div></div></main>;
};

export const ArticleListPage = () => {
  const [articles, setArticles] = useState<PublicArticle[] | null>(null);
  useEffect(() => { const controller = new AbortController(); getPublicArticles(controller.signal).then(setArticles).catch(() => setArticles([])); return () => controller.abort(); }, []);
  if (!articles) return <Loading />;
  return <main id="main-content" tabIndex={-1} className="public-page"><SeoHead path="/bai-viet" metadata={{ ...defaultMetadata(), title: 'Travel guides | HICO eSIM', description: 'Travel and eSIM guides from HICO.' }} /><div className="container"><div className="page-heading"><p>HICO guides</p><h1>Articles</h1></div><div className="public-card-grid">{articles.map((article) => <Link key={article.id} className="public-product-card" to={getArticlePath(article)}><img src={article.image || seoConfig.defaultImage} alt={article.title} /><div><h2>{article.title}</h2><p>{article.date}</p></div></Link>)}</div></div></main>;
};

const sanitizeHtml = (html: string) => {
  const documentFragment = new DOMParser().parseFromString(html, 'text/html');
  documentFragment.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove());
  documentFragment.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (attribute.name.startsWith('on') || (attribute.name === 'href' && !/^(https?:|mailto:|\/)/i.test(attribute.value))) element.removeAttribute(attribute.name);
    });
  });
  return documentFragment.body.innerHTML;
};

export const ArticlePage = () => {
  const { slug = '' } = useParams();
  const [article, setArticle] = useState<PublicArticle | null | undefined>(undefined);
  useEffect(() => { const controller = new AbortController(); getArticleBySlug(slug, controller.signal).then(setArticle).catch(() => setArticle(null)); return () => controller.abort(); }, [slug]);
  if (article === undefined) return <Loading />;
  if (!article) return <NotFound />;
  const path = getArticlePath(article);
  return <main id="main-content" tabIndex={-1} className="public-page article-page"><SeoHead path={path} metadata={articleMetadata(article)} schema={{ '@context': 'https://schema.org', '@graph': [breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Articles', path: '/bai-viet' }, { name: article.title, path }]), articleSchema(article, path)] }} /><article className="container article-content"><p>{article.date}</p><h1>{article.title}</h1>{article.image && <img src={article.image} alt={article.title} />}<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content || '') }} /></article></main>;
};

export const CartPage = ({ checkout = false }: { checkout?: boolean }) => {
  const { setIsCartOpen } = useApp();
  useEffect(() => { setIsCartOpen(true); return () => setIsCartOpen(false); }, [setIsCartOpen]);
  return <main id="main-content" tabIndex={-1} className="route-state"><SeoHead path={checkout ? '/thanh-toan' : '/gio-hang'} metadata={{ ...defaultMetadata(), title: checkout ? 'Checkout | HICO eSIM' : 'Cart | HICO eSIM', indexable: false }} noindex /><h1>{checkout ? 'Checkout' : 'Cart'}</h1><p>Your secure order panel is open.</p></main>;
};

export { NotFound };
