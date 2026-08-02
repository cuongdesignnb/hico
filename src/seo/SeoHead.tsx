import { useEffect, useMemo } from 'react';
import { buildCanonicalUrl, getSiteOrigin } from './buildCanonicalUrl';
import type { Metadata } from './buildMetadata';
import { JsonLd } from './JsonLd';

const absoluteImage = (image: string) => new URL(image, getSiteOrigin()).toString();

const setMeta = (selector: string, attribute: 'name' | 'property', key: string, value: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = value;
};

export const SeoHead = ({ path, metadata, schema, noindex = false }: {
  path: string;
  metadata: Metadata;
  schema?: Record<string, unknown> | null;
  noindex?: boolean;
}) => {
  const canonical = useMemo(() => buildCanonicalUrl(path), [path]);
  const image = useMemo(() => absoluteImage(metadata.image), [metadata.image]);
  useEffect(() => {
    document.title = metadata.title;
    setMeta('meta[name="description"]', 'name', 'description', metadata.description);
    setMeta('meta[name="robots"]', 'name', 'robots', noindex || !metadata.indexable ? 'noindex,nofollow' : 'index,follow');
    setMeta('meta[property="og:title"]', 'property', 'og:title', metadata.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', metadata.description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    setMeta('meta[property="og:image"]', 'property', 'og:image', image);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', metadata.title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', metadata.description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [canonical, image, metadata, noindex]);
  return <JsonLd id="route" data={schema ?? null} />;
};
