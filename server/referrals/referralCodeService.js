import { randomBytes } from 'node:crypto';
import { assertReferralCode } from './referralValidation.js';

const generate = () => `HICO-${randomBytes(6).toString('hex').toUpperCase()}`;

export const createReferralCodeService = ({ repository } = {}) => ({
  async getOrCreate(customerId) {
    const existing = await repository.findActiveCode(customerId);
    if (existing) return existing;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = assertReferralCode(generate());
      try { return await repository.createCode({ customerId, code }); }
      catch (error) { if (error?.code !== 'REFERRAL_CODE_CONFLICT') throw error; }
    }
    throw Object.assign(new Error('Referral code generation is unavailable.'), { code: 'REFERRAL_NOT_READY', status: 503 });
  },
});
