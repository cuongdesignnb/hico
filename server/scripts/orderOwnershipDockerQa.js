import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';

const primary = process.env.CUSTOMER_QA_PRIMARY_URL ?? 'http://localhost:5000';
const secondary = process.env.CUSTOMER_QA_SECONDARY_URL ?? 'http://localhost:5001';
const mailpit = process.env.CUSTOMER_QA_MAILPIT_URL ?? 'http://localhost:8025';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://hico:hico-pr152-qa-password@localhost:5432/hico' });

const request = (base, path, init = {}) => fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
const post = (base, path, body, headers = {}) => request(base, path, { method: 'POST', body: JSON.stringify(body), headers });
const cookies = (response) => response.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');

const mailToken = async (email, subject) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const messages = await (await fetch(`${mailpit}/api/v1/messages`)).json();
    const list = Array.isArray(messages) ? messages : messages.messages ?? [];
    const message = list.find((item) => JSON.stringify(item).includes(email) && JSON.stringify(item).includes(subject));
    if (message) {
      const id = message.ID ?? message.id;
      const detail = await (await fetch(`${mailpit}/api/v1/message/${id}`)).json();
      const url = JSON.stringify(detail).match(/https?:[^\s"\\]+/g)?.map((value) => value.replaceAll('\\u0026', '&')).find((value) => value.includes('token='));
      if (url) return new URL(url).searchParams.get('token');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Mailpit token unavailable for ${subject}`);
};

const createCustomer = async (base, label) => {
  const email = `ownership-${label}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.test`;
  const password = 'CorrectHorseBattery1';
  const register = await post(base, '/api/customer/auth/register', { email, password, displayName: `Ownership ${label}` });
  assert.equal(register.status, 201);
  const verificationToken = await mailToken(email, 'Verify your HICO account');
  assert.equal((await post(base, '/api/customer/auth/verify-email', { token: verificationToken })).status, 204);
  const login = await post(base, '/api/customer/auth/login', { email, password });
  assert.equal(login.status, 200);
  const body = await login.json();
  return { email, id: body.customer.id, cookie: cookies(login), csrf: body.csrfToken };
};

const seed = async (a, b, guestId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const snapshot = (id, email) => JSON.stringify({ orderId: id, customer: { email }, items: [], status: 'PENDING_CALLBACK' });
    for (const [id, customerId, status, email] of [['#QA-OWNED-A', a.id, 'OWNED', a.email], ['#QA-OWNED-B', b.id, 'OWNED', b.email], [guestId, null, 'GUEST_UNCLAIMED', a.email]]) {
      await client.query('INSERT INTO orders (order_id, customer_id, ownership_status, guest_email_snapshot, guest_phone_snapshot, ownership_version, status, currency, subtotal, snapshot, created_at, updated_at) VALUES ($1,$2,$3,$4,NULL,1,$5,$6,0,$7,NOW(),NOW())', [id, customerId, status, status === 'GUEST_UNCLAIMED' ? email : null, 'PENDING_CALLBACK', 'VND', snapshot(id, email)]);
      await client.query('INSERT INTO order_ownership_events (id, order_id, to_status, action, actor_type, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())', [crypto.randomUUID(), id, status, status === 'OWNED' ? 'ORDER_CREATED_AUTHENTICATED' : 'ORDER_CREATED_GUEST', 'QA', JSON.stringify({ qa: true })]);
    }
  } finally { await client.query('COMMIT'); client.release(); }
};

const cleanup = async (ids, customerIds) => {
  await pool.query('DELETE FROM orders WHERE order_id = ANY($1)', [ids]);
  await pool.query('DELETE FROM customers WHERE id = ANY($1)', [customerIds]);
};

const main = async () => {
  const a = await createCustomer(primary, 'a');
  const b = await createCustomer(secondary, 'b');
  const guestId = '#QA-GUEST-CLAIM';
  await seed(a, b, guestId);
  try {
    const listA = await request(primary, '/api/customer/orders', { headers: { cookie: a.cookie } });
    assert.equal(listA.status, 200);
    const listAJson = await listA.json();
    assert.deepEqual(listAJson.orders.map((order) => order.orderId), ['#QA-OWNED-A']);
    const listB = await request(secondary, '/api/customer/orders', { headers: { cookie: b.cookie } });
    assert.deepEqual((await listB.json()).orders.map((order) => order.orderId), ['#QA-OWNED-B']);
    const idor = await request(secondary, `/api/customer/orders/${encodeURIComponent('#QA-OWNED-A')}`, { headers: { cookie: b.cookie } });
    const idorBody = await idor.json();
    assert.equal(idor.status, 404, JSON.stringify({ status: idor.status, code: idorBody.code, orderId: idorBody.order?.orderId }));
    const claimRequest = await post(primary, `/api/customer/orders/${encodeURIComponent(guestId)}/claim/request`, {}, { cookie: a.cookie, 'x-csrf-token': a.csrf });
    assert.equal(claimRequest.status, 202);
    const claimToken = await mailToken(a.email, 'Claim your HICO order');
    const confirms = await Promise.all([5000, 5001].map((port) => post(`http://localhost:${port}`, `/api/customer/orders/${encodeURIComponent(guestId)}/claim/confirm`, { token: claimToken }, { cookie: a.cookie, 'x-csrf-token': a.csrf })));
    assert.equal(confirms.filter((response) => response.status === 200).length, 1);
    assert.equal(confirms.filter((response) => response.status !== 200).length, 1);
    const counts = await pool.query("SELECT (SELECT COUNT(*) FROM orders WHERE order_id=$1 AND customer_id=$2 AND ownership_status='OWNED') AS owned, (SELECT COUNT(*) FROM guest_order_claims WHERE order_id=$1 AND consumed_at IS NOT NULL) AS consumed, (SELECT COUNT(*) FROM order_ownership_events WHERE order_id=$1 AND action='GUEST_CLAIM_CONFIRMED') AS success_events", [guestId, a.id]);
    assert.deepEqual(counts.rows[0], { owned: '1', consumed: '1', success_events: '1' });
    const tokenColumns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='guest_order_claims' ORDER BY ordinal_position");
    assert.equal(tokenColumns.rows.some((row) => row.column_name === 'token'), false);
    console.log(JSON.stringify({ status: 'ownership_qa_passed', idor: '404', concurrentClaim: 'one_winner', rawTokenColumn: false }));
  } finally { await cleanup(['#QA-OWNED-A', '#QA-OWNED-B', guestId], [a.id, b.id]); }
};

try { await main(); } finally { await pool.end(); }
