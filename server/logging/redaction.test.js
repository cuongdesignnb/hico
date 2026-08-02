import assert from 'node:assert/strict';
import test from 'node:test';
import { redact } from './redaction.js';

test('redacts request credentials and customer-sensitive values recursively', () => {
  const value = redact({ authorization: 'Bearer raw', nested: { csrfToken: 'raw', email: 'person@example.test' }, safe: 'keep' });
  assert.equal(value.authorization, '[REDACTED]');
  assert.equal(value.nested.csrfToken, '[REDACTED]');
  assert.equal(value.nested.email, '[REDACTED]');
  assert.equal(value.safe, 'keep');
});
