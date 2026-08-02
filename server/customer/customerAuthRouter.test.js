import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';

import { createCustomerAuthCookies } from './customerAuthCookies.js';
import { createCustomerAuthRouter } from './customerAuthRouter.js';
import { createCustomerAuthService } from './customerAuthService.js';
import { createSessionService } from '../auth/sessionService.js';

const env = {
  NODE_ENV: 'test',
  CUSTOMER_ACCOUNT_MODE: 'real',
  SESSION_SECRET: 'customer-session-secret-for-tests-1234567890',
  CSRF_SECRET: 'customer-csrf-secret-for-tests-1234567890',
  CUSTOMER_TOKEN_SECRET: 'customer-token-secret-for-tests-1234567890',
  CUSTOMER_AUTH_MAX_FAILED_LOGINS: '3',
  CUSTOMER_AUTH_LOCK_MINUTES: '1',
};

const createMemoryCustomerRepository = () => {
  const customers = new Map();
  const tokens = new Map();
  const events = [];
  return {
    customers,
    tokens,
    events,
    async findByEmail(email) {
      return [...customers.values()].find((customer) => customer.email === email) ?? null;
    },
    async findById(id) {
      return customers.get(id) ?? null;
    },
    async create({ customer, profile }) {
      if (await this.findByEmail(customer.email)) throw Object.assign(new Error('exists'), { code: 'CUSTOMER_ALREADY_EXISTS' });
      const result = { ...customer, profile };
      customers.set(result.id, result);
      return result;
    },
    async update(id, update) {
      const current = customers.get(id);
      if (!current) return null;
      const result = { ...current, ...update };
      customers.set(id, result);
      return result;
    },
    async revokeActiveTokens(table, customerId) {
      for (const token of tokens.values()) {
        if (token.table === table && token.customerId === customerId && !token.consumedAt) token.revokedAt = new Date().toISOString();
      }
    },
    async createToken(table, token) {
      tokens.set(token.tokenHash, { ...token, table, consumedAt: null, revokedAt: null });
    },
    async consumeToken(table, tokenHash, timestamp) {
      const token = tokens.get(tokenHash);
      if (!token || token.table !== table || token.consumedAt || token.revokedAt || Date.parse(token.expiresAt) <= Date.parse(timestamp)) return null;
      token.consumedAt = timestamp;
      return token.customerId;
    },
    async tokenState(table, tokenHash, timestamp) {
      const token = tokens.get(tokenHash);
      if (!token || token.table !== table) return 'missing';
      if (token.consumedAt || token.revokedAt) return 'consumed';
      return Date.parse(token.expiresAt) <= Date.parse(timestamp) ? 'expired' : 'active';
    },
    async createSecurityEvent(event) {
      events.push(event);
    },
  };
};

const createMemorySessionRepository = () => {
  const sessions = new Map();
  return {
    sessions,
    async findByTokenHash(hash) {
      return [...sessions.values()].find((session) => session.tokenHash === hash) ?? null;
    },
    async create(session) {
      sessions.set(session.id, { ...session });
      return sessions.get(session.id);
    },
    async update(id, update) {
      const session = sessions.get(id);
      if (!session) return null;
      const next = { ...session, ...update };
      sessions.set(id, next);
      return next;
    },
    async revokeById(id, reason) {
      return this.update(id, { revokedAt: new Date().toISOString(), revokeReason: reason });
    },
    async revokeIfActive(id, reason) {
      const session = sessions.get(id);
      if (!session || session.revokedAt) return false;
      sessions.set(id, { ...session, revokedAt: new Date().toISOString(), revokeReason: reason });
      return true;
    },
    async revokeByUserId(customerId, reason) {
      for (const [id, session] of sessions) if (session.userId === customerId && !session.revokedAt) sessions.set(id, { ...session, revokedAt: new Date().toISOString(), revokeReason: reason });
    },
    async listByUserId(customerId) {
      return [...sessions.values()].filter((session) => session.userId === customerId && !session.revokedAt);
    },
    async revokeOwnedSession(id, customerId, reason) {
      const session = sessions.get(id);
      if (!session || session.userId !== customerId || session.revokedAt) return null;
      const next = { ...session, revokedAt: new Date().toISOString(), revokeReason: reason };
      sessions.set(id, next);
      return next;
    },
  };
};

const cookieHeader = (response) => response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');

const withServer = async (callback) => {
  const customerRepository = createMemoryCustomerRepository();
  const customerSessionRepository = createMemorySessionRepository();
  const sessionService = createSessionService({
    sessionRepository: customerSessionRepository,
    sessionSecret: env.SESSION_SECRET,
    csrfSecret: env.CSRF_SECRET,
    env,
  });
  const deliveries = [];
  const customerAuthService = createCustomerAuthService({
    customerRepository,
    customerSessionRepository,
    sessionService,
    env,
    tokenDelivery: {
      async sendVerification(payload) { deliveries.push({ type: 'verify', ...payload }); },
      async sendPasswordReset(payload) { deliveries.push({ type: 'reset', ...payload }); },
    },
  });
  const app = express();
  app.use(express.json());
  app.use('/api/customer', createCustomerAuthRouter({
    customerAuthService,
    sessionService,
    authCookies: createCustomerAuthCookies({ env }),
    readiness: { evaluate: async () => ({ status: 'healthy', mode: 'real', blockers: [] }) },
    env,
  }));
  app.get('/api/admin/check', (req, res) => {
    if (!req.get('cookie')?.includes('hico_admin_session=')) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    return res.json({ ok: true });
  });
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    await callback({
      baseUrl: `http://127.0.0.1:${server.address().port}`,
      customerRepository,
      customerSessionRepository,
      deliveries,
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
};

const json = (url, body, headers = {}) => fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

test('customer identity verifies, authenticates, rotates, and never leaks raw tokens', async () => {
  await withServer(async ({ baseUrl, customerRepository, deliveries }) => {
    const register = await json(`${baseUrl}/api/customer/auth/register`, {
      email: 'Customer@Example.test',
      password: 'CorrectHorseBattery1',
      displayName: 'Customer',
      account_type: 'admin',
      role: 'super_admin',
    });
    assert.equal(register.status, 201);
    const registered = await register.json();
    assert.equal(registered.customer.email, 'customer@example.test');
    assert.equal(registered.customer.status, 'pending_verification');
    assert.equal(JSON.stringify(registered).includes('token'), false);
    assert.equal(customerRepository.customers.size, 1);
    assert.equal([...customerRepository.customers.values()][0].status, 'pending_verification');
    assert.equal(deliveries.length, 1);
    assert.equal(JSON.stringify([...customerRepository.tokens.values()]).includes(deliveries[0].token), false);

    const beforeVerify = await json(`${baseUrl}/api/customer/auth/login`, { email: 'customer@example.test', password: 'CorrectHorseBattery1' });
    assert.equal(beforeVerify.status, 401);
    assert.deepEqual(await beforeVerify.json(), { error: 'Thong tin dang nhap khong hop le.', code: 'INVALID_CREDENTIALS' });

    const verify = await json(`${baseUrl}/api/customer/auth/verify-email`, { token: deliveries[0].token });
    assert.equal(verify.status, 204);
    const replayVerify = await json(`${baseUrl}/api/customer/auth/verify-email`, { token: deliveries[0].token });
    assert.equal(replayVerify.status, 400);
    assert.equal((await replayVerify.json()).code, 'VERIFICATION_TOKEN_INVALID');

    const unknown = await json(`${baseUrl}/api/customer/auth/login`, { email: 'unknown@example.test', password: 'wrong-password' });
    const wrongPassword = await json(`${baseUrl}/api/customer/auth/login`, { email: 'customer@example.test', password: 'wrong-password' });
    assert.deepEqual(await unknown.json(), await wrongPassword.json());

    const login = await json(`${baseUrl}/api/customer/auth/login`, { email: 'customer@example.test', password: 'CorrectHorseBattery1' });
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    const cookie = cookieHeader(login);
    assert.equal(loginBody.customer.passwordHash, undefined);
    assert.ok(cookie.includes('hico_customer_session='));
    assert.equal((await fetch(`${baseUrl}/api/admin/check`, { headers: { cookie } })).status, 401);

    const me = await fetch(`${baseUrl}/api/customer/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).customer.email, 'customer@example.test');

    const csrfDenied = await json(`${baseUrl}/api/customer/auth/refresh`, {}, { cookie });
    assert.equal(csrfDenied.status, 403);

    const refresh = await json(`${baseUrl}/api/customer/auth/refresh`, {}, { cookie, 'x-csrf-token': loginBody.csrfToken });
    assert.equal(refresh.status, 200);
    const refreshedCookie = cookieHeader(refresh);
    const oldSession = await fetch(`${baseUrl}/api/customer/me`, { headers: { cookie } });
    assert.equal(oldSession.status, 401);
    const currentSession = await fetch(`${baseUrl}/api/customer/me`, { headers: { cookie: refreshedCookie } });
    assert.equal(currentSession.status, 200);
  });
});

test('customer reset is enumeration-safe and revocation is owner-scoped', async () => {
  await withServer(async ({ baseUrl, deliveries }) => {
    const createVerified = async (email) => {
      await json(`${baseUrl}/api/customer/auth/register`, { email, password: 'CorrectHorseBattery1', displayName: email });
      const delivery = deliveries.find((item) => item.type === 'verify' && item.email === email);
      await json(`${baseUrl}/api/customer/auth/verify-email`, { token: delivery.token });
      const login = await json(`${baseUrl}/api/customer/auth/login`, { email, password: 'CorrectHorseBattery1' });
      return { body: await login.json(), cookie: cookieHeader(login) };
    };
    const first = await createVerified('first@example.test');
    const second = await createVerified('second@example.test');

    const unknownReset = await json(`${baseUrl}/api/customer/auth/request-password-reset`, { email: 'missing@example.test' });
    const knownReset = await json(`${baseUrl}/api/customer/auth/request-password-reset`, { email: 'first@example.test' });
    assert.deepEqual(await unknownReset.json(), await knownReset.json());
    const reset = deliveries.find((item) => item.type === 'reset' && item.email === 'first@example.test');
    assert.ok(reset);
    const completed = await json(`${baseUrl}/api/customer/auth/reset-password`, { token: reset.token, password: 'NewCorrectHorseBattery2' });
    assert.equal(completed.status, 204);
    assert.equal((await fetch(`${baseUrl}/api/customer/me`, { headers: { cookie: first.cookie } })).status, 401);

    const firstLogin = await json(`${baseUrl}/api/customer/auth/login`, { email: 'first@example.test', password: 'NewCorrectHorseBattery2' });
    const firstBody = await firstLogin.json();
    const firstCookie = cookieHeader(firstLogin);
    const secondSessions = await fetch(`${baseUrl}/api/customer/sessions`, { headers: { cookie: second.cookie } });
    const secondSessionId = (await secondSessions.json()).sessions[0].id;
    const crossRevoke = await fetch(`${baseUrl}/api/customer/sessions/${secondSessionId}`, {
      method: 'DELETE',
      headers: { cookie: firstCookie, 'x-csrf-token': firstBody.csrfToken },
    });
    assert.equal(crossRevoke.status, 404);

    const logout = await json(`${baseUrl}/api/customer/auth/logout`, {}, { cookie: firstCookie, 'x-csrf-token': firstBody.csrfToken });
    assert.equal(logout.status, 204);
  });
});
