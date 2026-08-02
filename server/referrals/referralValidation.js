const CODE_PATTERN = /^HICO-[A-Z0-9]{12}$/;

export const normalizeReferralCode = (value) => String(value ?? '').trim().toUpperCase();
export const assertReferralCode = (value) => {
  const code = normalizeReferralCode(value);
  if (!CODE_PATTERN.test(code)) throw Object.assign(new Error('Referral code is invalid.'), { code: 'REFERRAL_CODE_INVALID', status: 400 });
  return code;
};
export const parseReferralQuery = ({ page = 1, pageSize = 20, status } = {}) => {
  const safeStatus = status ? String(status).toUpperCase() : null;
  if (safeStatus && !['PENDING', 'QUALIFIED', 'REWARDED', 'REVERSED', 'REJECTED', 'MANUAL_REVIEW'].includes(safeStatus)) throw Object.assign(new Error('Referral filter is invalid.'), { code: 'REFERRAL_CODE_INVALID', status: 400 });
  return { page: Math.max(1, Number.parseInt(page, 10) || 1), pageSize: Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 20)), status: safeStatus };
};
