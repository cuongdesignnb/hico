const sensitive = /authorization|cookie|csrf|session|password|secret|token|signature|lpa|pin|puk|address|phone|email/i;

export const redact = (value, key = '') => {
  if (sensitive.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]));
  return value;
};
