import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReferralCode, normalizeReferralCode, parseReferralQuery } from './referralValidation.js';
import { createReferralCodeService } from './referralCodeService.js';

test('referral codes are normalized and accept only non-PII HICO format', () => {
  assert.equal(normalizeReferralCode(' hico-ab12cd34ef56 '), 'HICO-AB12CD34EF56');
  assert.equal(assertReferralCode('hico-ab12cd34ef56'), 'HICO-AB12CD34EF56');
  assert.throws(() => assertReferralCode('HICOSON50'), (error) => error.code === 'REFERRAL_CODE_INVALID');
  assert.throws(() => assertReferralCode('HICO-ABC'), (error) => error.code === 'REFERRAL_CODE_INVALID');
});
test('referral code generation retries a uniqueness race and stays stable after creation', async () => {
  let attempts = 0;
  const repository = {
    async findActiveCode() { return null; },
    async createCode({ code }) { attempts += 1; if (attempts === 1) throw Object.assign(new Error('conflict'), { code: 'REFERRAL_CODE_CONFLICT' }); return { code, status: 'ACTIVE' }; },
  };
  const code = await createReferralCodeService({ repository }).getOrCreate('customer-1');
  assert.match(code.code, /^HICO-[A-Z0-9]{12}$/);
  assert.equal(attempts, 2);
});

test('referral query parsing is bounded and rejects unsafe status filters', () => {
  assert.deepEqual(parseReferralQuery({ page: '2', pageSize: '999', status: 'rewarded' }), { page: 2, pageSize: 50, status: 'REWARDED' });
  assert.throws(() => parseReferralQuery({ status: 'DROP TABLE' }), (error) => error.code === 'REFERRAL_CODE_INVALID');
});
