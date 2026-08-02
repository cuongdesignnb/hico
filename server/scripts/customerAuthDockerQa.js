import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';

const primary = process.env.CUSTOMER_QA_PRIMARY_URL ?? 'http://backend:5000';
const secondary = process.env.CUSTOMER_QA_SECONDARY_URL ?? 'http://backend-secondary:5000';
const mailpit = process.env.CUSTOMER_QA_MAILPIT_URL ?? 'http://mailpit:8025';
const statePath = '/tmp/hico-customer-auth-qa.json';

const request = async (baseUrl, path, init = {}) => fetch(`${baseUrl}${path}`, {
  ...init,
  headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
});
const post = (baseUrl, path, body, headers) => request(baseUrl, path, { method: 'POST', body: JSON.stringify(body), headers });
const cookieHeader = (response) => response.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');

const findToken = async (email) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${mailpit}/api/v1/messages`);
    if (response.ok) {
      const payload = await response.json();
      const messages = Array.isArray(payload) ? payload : payload.messages ?? [];
      const candidate = messages.find((message) => JSON.stringify(message).includes(email) && JSON.stringify(message).includes('Verify your HICO account'));
      const id = candidate?.ID ?? candidate?.id;
      if (id) {
        const detailResponse = await fetch(`${mailpit}/api/v1/message/${id}`);
        if (detailResponse.ok) {
          const text = JSON.stringify(await detailResponse.json());
          const url = text.match(/https?:[^\s"\\]+/g)?.map((value) => value.replace(/\\u0026/g, '&')).find((value) => value.includes('token='));
          const token = url ? new URL(url).searchParams.get('token') : null;
          if (token) return token;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('Verification delivery was not available to Docker QA.');
};

const runInitial = async () => {
  const email = `customer-qa-${Date.now()}@example.test`;
  const register = await post(primary, '/api/customer/auth/register', {
    email,
    password: 'CorrectHorseBattery1',
    displayName: 'Customer QA',
    account_type: 'admin',
    role: 'super_admin',
  });
  assert.equal(register.status, 201);
  const registration = await register.json();
  assert.equal(registration.verificationRequired, true);
  assert.equal(JSON.stringify(registration).includes('token'), false);

  const token = await findToken(email);
  const verify = await post(primary, '/api/customer/auth/verify-email', { token });
  assert.equal(verify.status, 204);

  const login = await post(primary, '/api/customer/auth/login', { email, password: 'CorrectHorseBattery1' });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  const cookie = cookieHeader(login);
  assert.ok(cookie.includes('hico_customer_session='));

  const customerOnSecondary = await request(secondary, '/api/customer/me', { headers: { cookie } });
  assert.equal(customerOnSecondary.status, 200);
  const adminWithCustomerCookie = await request(primary, '/api/admin/catalog/source-status', { headers: { cookie } });
  assert.equal(adminWithCustomerCookie.status, 401);

  const refreshRequests = await Promise.all([
    post(primary, '/api/customer/auth/refresh', {}, { cookie, 'x-csrf-token': loginBody.csrfToken }),
    post(secondary, '/api/customer/auth/refresh', {}, { cookie, 'x-csrf-token': loginBody.csrfToken }),
  ]);
  const statuses = refreshRequests.map((response) => response.status).sort();
  assert.deepEqual(statuses, [200, 401]);
  const winner = refreshRequests.find((response) => response.status === 200);
  const refreshed = await winner.json();
  const refreshedCookie = cookieHeader(winner);

  const oldSession = await request(secondary, '/api/customer/me', { headers: { cookie } });
  assert.equal(oldSession.status, 401);
  const liveSession = await request(secondary, '/api/customer/me', { headers: { cookie: refreshedCookie } });
  assert.equal(liveSession.status, 200);

  await writeFile(statePath, JSON.stringify({ cookie: refreshedCookie, csrfToken: refreshed.csrfToken }), { mode: 0o600 });
  return { status: 'initial_passed', checks: 10 };
};

const verifyPersistenceAndLogout = async () => {
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  const persisted = await request(secondary, '/api/customer/me', { headers: { cookie: state.cookie } });
  assert.equal(persisted.status, 200);
  const logout = await post(secondary, '/api/customer/auth/logout', {}, { cookie: state.cookie, 'x-csrf-token': state.csrfToken });
  assert.equal(logout.status, 204);
  const revoked = await request(primary, '/api/customer/me', { headers: { cookie: state.cookie } });
  assert.equal(revoked.status, 401);
  await rm(statePath, { force: true });
  return { status: 'restart_and_logout_passed', checks: 3 };
};

const result = process.argv.includes('--verify-persisted') ? await verifyPersistenceAndLogout() : await runInitial();
process.stdout.write(`${JSON.stringify(result)}\n`);
