const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const getSiteOrigin = (): string => {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (import.meta.env.PROD && parsed.protocol !== 'https:') throw new Error('Production URL must use HTTPS.');
      return trimTrailingSlash(parsed.origin);
    } catch {
      // Use the current origin during local development and misconfigured previews.
    }
  }
  return trimTrailingSlash(window.location.origin);
};

export const buildCanonicalUrl = (path: string): string => {
  const normalized = `/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`.replace(/\/{2,}/g, '/');
  return `${getSiteOrigin()}${normalized === '/' ? '' : normalized}`;
};
