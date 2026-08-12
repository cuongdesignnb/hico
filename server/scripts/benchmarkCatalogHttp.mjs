import { performance } from 'node:perf_hooks';

const baseUrl = process.env.BENCHMARK_BASE_URL ?? 'http://localhost:5000';
let adminCookie = '';
if (process.env.BENCHMARK_ADMIN_EMAIL && process.env.BENCHMARK_ADMIN_PASSWORD) {
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.BENCHMARK_ADMIN_EMAIL, password: process.env.BENCHMARK_ADMIN_PASSWORD }) });
  if (!login.ok) throw new Error(`Admin benchmark login failed: ${login.status}`);
  adminCookie = login.headers.getSetCookie?.().map((value) => value.split(';')[0]).join('; ') ?? '';
}
const targets = [
  '/api/catalog/products?page=1&pageSize=20',
  '/api/admin/catalog/products?page=1&pageSize=20',
];

for (const target of targets) {
  const samples = [];
  let bytes = 0;
  for (let index = 0; index < 3; index += 1) {
    const start = performance.now();
    const response = await fetch(`${baseUrl}${target}`, adminCookie ? { headers: { cookie: adminCookie } } : undefined);
    const body = await response.text();
    samples.push(Number((performance.now() - start).toFixed(2)));
    bytes = Buffer.byteLength(body);
    if (!response.ok) throw new Error(`${target} ${response.status}: ${body}`);
  }
  console.log(JSON.stringify({ target, status: 200, cold: samples[0], warm1: samples[1], warm2: samples[2], bytes }));
}
