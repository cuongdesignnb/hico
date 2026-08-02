import { fileURLToPath } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const check = (baseUrl, route) => fetch(new URL(route, baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(10_000) }).then(async (response) => ({ route, statusCode: response.status, passed: response.status >= 200 && response.status < 400, contentType: response.headers.get('content-type') ?? null }));

export const runProductionCanaryChecks = async ({ env = process.env, checkImpl = check } = {}) => {
  const blockers = [];
  const baseUrl = env.PRODUCTION_BASE_URL || env.PUBLIC_SITE_URL;
  let origin;
  try { origin = new URL(baseUrl); } catch { blockers.push('PRODUCTION_BASE_URL_REQUIRED'); }
  if (origin?.protocol !== 'https:') blockers.push('PRODUCTION_CANARY_HTTPS_REQUIRED');
  if (env.PRODUCTION_CANARY_APPROVED !== 'true') blockers.push('PRODUCTION_CANARY_APPROVAL_REQUIRED');
  if (!env.CANARY_INTERNAL_EVIDENCE_PATH) blockers.push('CANARY_INTERNAL_EVIDENCE_REQUIRED');
  if (!origin) return { status: 'blocked', blockers, checkedAt: new Date().toISOString(), checks: [] };
  const routes = ['/', '/sitemap.xml', '/robots.txt', '/api/health/session-store', '/api/health/security', '/api/health/production-readiness'];
  const checks = await Promise.all(routes.map(async (route) => {
    try { return await checkImpl(origin.href, route); } catch (error) { return { route, statusCode: 0, passed: false, error: error.code ?? 'REQUEST_FAILED' }; }
  }));
  if (checks.some((item) => !item.passed)) blockers.push('CANARY_ROUTE_CHECK_FAILED');
  return { status: blockers.length ? 'blocked' : 'verified', blockers, checkedAt: new Date().toISOString(), phase: env.PRODUCTION_CANARY_PHASE ?? null, trafficScope: env.PRODUCTION_CANARY_TRAFFIC_SCOPE ?? null, checks, internalEvidencePath: env.CANARY_INTERNAL_EVIDENCE_PATH, owner: env.PRODUCTION_RELEASE_OWNER ?? null, approver: env.PRODUCTION_CANARY_APPROVER ?? null };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await runProductionCanaryChecks();
  if (process.env.PRODUCTION_CANARY_EVIDENCE_PATH) { await mkdir(path.dirname(process.env.PRODUCTION_CANARY_EVIDENCE_PATH), { recursive: true }); await writeFile(process.env.PRODUCTION_CANARY_EVIDENCE_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
  console.log(JSON.stringify(report));
  if (report.status !== 'verified') process.exitCode = 1;
}
