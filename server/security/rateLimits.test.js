import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter } from './rateLimits.js';

const response = () => ({
  headers: {},
  statusCode: 200,
  set(name, value) { this.headers[name] = value; return this; },
  status(statusCode) { this.statusCode = statusCode; return this; },
  json(body) { this.body = body; return this; },
});

test('rate limiter rejects requests after the configured limit', () => {
  const limit = createRateLimiter({ windowMs: 60_000, max: 1 });
  const request = { ip: '127.0.0.1', method: 'POST', requestId: 'request-1' };
  let nextCalls = 0;
  limit(request, response(), () => { nextCalls += 1; });
  const blocked = response();
  limit(request, blocked, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.code, 'RATE_LIMITED');
  assert.ok(blocked.headers['Retry-After']);
});
