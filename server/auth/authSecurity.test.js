import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createAuthCookies } from './authCookies.js';
import { createAuthRouter } from './authRouter.js';
import { createAuthService } from './authService.js';
import { createSessionRepository } from './sessionRepository.js';
import { createSessionService } from './sessionService.js';
import { createUserRepository } from './userRepository.js';
import { createAdminAuthorization, createAuthenticate, createCsrfProtection } from '../security/authenticate.js';
import { validateProductionSecurity } from '../security/productionSecurityValidator.js';

const withServer = async (callback) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-auth-'));
  const env = {
    NODE_ENV: 'test',
    SESSION_SECRET: 'session-secret-for-tests-1234567890',
    ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
    ADMIN_BOOTSTRAP_PASSWORD: 'CorrectHorseBattery1',
    AUTH_MAX_FAILED_LOGINS: '3',
    AUTH_LOCK_MINUTES: '1',
  };
  const userRepository = createUserRepository({ uploadsDirectory: directory });
  const sessionRepository = createSessionRepository({ uploadsDirectory: directory });
  const sessionService = createSessionService({ sessionRepository, sessionSecret: env.SESSION_SECRET, env });
  const authService = createAuthService({ userRepository, sessionService, env, securityAudit: () => {} });
  await authService.ensureBootstrap();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ authService, sessionService, authCookies: createAuthCookies({ env }), env, securityAudit: () => {} }));
  app.use('/api/admin', createAuthenticate({ authService, sessionService }), createCsrfProtection({ sessionService }), createAdminAuthorization({ securityReady: () => true }));
  app.get('/api/admin/catalog/check', (_req, res) => res.json({ ok: true }));
  app.post('/api/admin/catalog/check', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  await once(server, 'listening');
  try { await callback(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); await once(server, 'close'); await rm(directory, { recursive: true, force: true }); }
};

const cookieHeader = (response) => response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');

test('server sessions protect admin routes and enforce CSRF', async () => {
  await withServer(async (baseUrl) => {
    const anonymous = await fetch(`${baseUrl}/api/admin/catalog/check`);
    assert.equal(anonymous.status, 401);
    const invalid = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'unknown@example.com', password: 'wrong' }) });
    assert.equal(invalid.status, 401);
    assert.equal((await invalid.json()).code, 'AUTH_INVALID_CREDENTIALS');
    const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'CorrectHorseBattery1' }) });
    assert.equal(login.status, 200);
    const body = await login.json();
    const cookie = cookieHeader(login);
    assert.equal(body.user.passwordHash, undefined);
    assert.equal((await fetch(`${baseUrl}/api/admin/catalog/check`, { headers: { cookie } })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/admin/catalog/check`, { method: 'POST', headers: { cookie } })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/admin/catalog/check`, { method: 'POST', headers: { cookie, 'x-csrf-token': body.csrfToken } })).status, 200);
    const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { cookie, 'x-csrf-token': body.csrfToken } });
    assert.equal(logout.status, 204);
    assert.equal((await fetch(`${baseUrl}/api/admin/catalog/check`, { headers: { cookie } })).status, 401);
  });
});

test('production security validation fails closed without required secrets', () => {
  const result = validateProductionSecurity({ NODE_ENV: 'production', PUBLIC_SITE_URL: 'http://example.com', CORS_ALLOWED_ORIGINS: '*', SESSION_SECRET: 'short', CSRF_SECRET: '', WORLDMOVE_WEBHOOK_SECRET: '' });
  assert.equal(result.status, 'not_ready');
  assert.ok(result.blockers.includes('CORS_WILDCARD_FORBIDDEN'));
  assert.ok(result.blockers.includes('PUBLIC_SITE_URL_HTTPS_REQUIRED'));
  assert.ok(result.blockers.includes('AUTH_SHARED_STORE_REQUIRED'));
});
