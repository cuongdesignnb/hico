export const createRobotsTxt = ({ siteUrl, environment = 'development' }) => {
  if (environment !== 'production') return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\nDisallow: /quan-tri\nDisallow: /tai-khoan\nDisallow: /gio-hang\nDisallow: /thanh-toan\nSitemap: ${String(siteUrl).replace(/\/$/, '')}/sitemap.xml\n`;
};
