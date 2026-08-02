import dns from 'node:dns/promises';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const request = (url, { redirect = 'manual' } = {}) => new Promise((resolve, reject) => {
  const target = new URL(url);
  const client = target.protocol === 'https:' ? https : http;
  const req = client.request(target, { method: 'GET', timeout: 10_000, headers: { 'user-agent': 'hico-production-launch-verifier' } }, (res) => {
    const chunks = [];
    res.setEncoding('utf8');
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body: chunks.join(''), redirect }));
  });
  req.on('timeout', () => req.destroy(new Error('request_timeout')));
  req.on('error', reject);
  req.end();
});

const originFrom = (value) => {
  try { return new URL(value); } catch { return null; }
};
const hasHttpsOrigin = (url) => url?.protocol === 'https:' && !/localhost|127\.0\.0\.1|example\.com/i.test(url.hostname);
const containsOrigin = (body, origin) => body.includes(origin);

export const verifyProductionDomain = async ({ env = process.env, requestImpl = request, dnsLookup = dns.lookup } = {}) => {
  const blockers = [];
  const warnings = [];
  const publicUrl = originFrom(env.PUBLIC_SITE_URL);
  const viteUrl = originFrom(env.VITE_PUBLIC_SITE_URL);
  if (!hasHttpsOrigin(publicUrl)) blockers.push('PUBLIC_SITE_URL_HTTPS_REQUIRED');
  if (!viteUrl || viteUrl.origin !== publicUrl?.origin) blockers.push('PUBLIC_SITE_URL_MISMATCH');
  const allowedOrigins = String(env.CORS_ALLOWED_ORIGINS ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!publicUrl || !allowedOrigins.includes(publicUrl.origin)) blockers.push('CORS_PUBLIC_ORIGIN_REQUIRED');
  if (!publicUrl) return { status: 'blocked', blockers, warnings, checkedAt: new Date().toISOString() };
  if (!env.PRODUCTION_DOMAIN_OWNER || !env.PRODUCTION_DOMAIN_APPROVER) blockers.push('DOMAIN_OWNER_APPROVER_REQUIRED');

  let addresses = [];
  try {
    const result = await dnsLookup(publicUrl.hostname, { all: true });
    addresses = result.map((item) => item.address);
  } catch { blockers.push('DNS_RESOLUTION_FAILED'); }

  let tls = null;
  try {
    tls = await new Promise((resolve, reject) => {
      const socket = https.connect({ host: publicUrl.hostname, port: 443, servername: publicUrl.hostname, rejectUnauthorized: true }, () => {
        const certificate = socket.getPeerCertificate();
        socket.end();
        resolve({ issuer: certificate.issuer?.O ?? certificate.issuer?.CN ?? null, subject: certificate.subject?.CN ?? null, validTo: certificate.valid_to ?? null });
      });
      socket.setTimeout(10_000, () => socket.destroy(new Error('tls_timeout')));
      socket.on('error', reject);
    });
    if (!tls.validTo || Date.parse(tls.validTo) <= Date.now()) blockers.push('TLS_CERTIFICATE_EXPIRED');
  } catch { blockers.push('TLS_CERTIFICATE_INVALID'); }

  let httpsResult;
  try { httpsResult = await requestImpl(publicUrl.href); } catch { httpsResult = { statusCode: 0, headers: {}, body: '' }; }
  if (httpsResult.statusCode >= 500 || httpsResult.statusCode === 0) blockers.push('HTTPS_ORIGIN_UNAVAILABLE');
  const hsts = String(httpsResult.headers['strict-transport-security'] ?? '');
  if (!/max-age=\d{7,}/i.test(hsts)) blockers.push('HSTS_POLICY_INVALID');

  const httpUrl = new URL(publicUrl.href);
  httpUrl.protocol = 'http:';
  let redirect;
  try { redirect = await requestImpl(httpUrl.href); } catch { redirect = { statusCode: 0, headers: {}, body: '' }; }
  const location = String(redirect.headers.location ?? '');
  if (![301, 302, 307, 308].includes(redirect.statusCode) || !location.startsWith('https://')) blockers.push('HTTP_HTTPS_REDIRECT_INVALID');

  const origin = publicUrl.origin;
  const safeRequest = async (url) => { try { return await requestImpl(url); } catch { return { statusCode: 0, headers: {}, body: '' }; } };
  const [sitemap, robots, route] = await Promise.all([
    safeRequest(new URL('/sitemap.xml', origin).href),
    safeRequest(new URL('/robots.txt', origin).href),
    safeRequest(new URL(env.PRODUCTION_DIRECT_ROUTE ?? '/san-pham', origin).href),
  ]);
  if (sitemap.statusCode !== 200 || !containsOrigin(sitemap.body, origin)) blockers.push('SITEMAP_ORIGIN_INVALID');
  if (robots.statusCode !== 200 || !containsOrigin(robots.body, `${origin}/sitemap.xml`)) blockers.push('ROBOTS_SITEMAP_INVALID');
  if (route.statusCode >= 500 || route.statusCode === 0) blockers.push('DIRECT_ROUTE_UNAVAILABLE');
  if (!containsOrigin(httpsResult.body, origin)) blockers.push('HOME_CANONICAL_NOT_OBSERVED');

  const report = {
    status: blockers.length ? 'blocked' : 'verified', blockers, warnings, checkedAt: new Date().toISOString(),
    domain: publicUrl.hostname, resolvedAddresses: addresses, tls, httpRedirect: { statusCode: redirect.statusCode, location: location ? new URL(location, origin).origin : null },
    hsts: hsts ? 'present' : 'missing', canonicalOrigin: origin, sitemapOrigin: origin, robotsSitemap: `${origin}/sitemap.xml`, directRoute: env.PRODUCTION_DIRECT_ROUTE ?? '/san-pham',
    owner: env.PRODUCTION_DOMAIN_OWNER ?? null, approver: env.PRODUCTION_DOMAIN_APPROVER ?? null,
  };
  const reportPath = env.PRODUCTION_DOMAIN_EVIDENCE_PATH;
  if (reportPath) { await mkdir(path.dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
  return report;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await verifyProductionDomain();
  console.log(JSON.stringify(report));
  if (report.status !== 'verified') process.exitCode = 1;
}
