const MILESTONES = Object.freeze({
  esim: 'PROVISIONED',
  topup: 'PROVISIONED',
  physical_sim: 'SHIPPED',
  device_sale: 'SHIPPED',
});

const toDecimalText = (value) => {
  if (typeof value === 'bigint') return `${value}.00`;
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  return text;
};

export const parseVndMinorUnits = (value) => {
  const text = toDecimalText(value);
  if (!text) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

export const calculateEarnPoints = ({ unitPrice, quantity = 1, currency = 'VND' } = {}) => {
  if (String(currency).toUpperCase() !== 'VND') return 0;
  const priceMinor = parseVndMinorUnits(unitPrice);
  const count = Number.parseInt(quantity, 10);
  if (priceMinor === null || !Number.isSafeInteger(count) || count <= 0 || priceMinor <= 0n) return 0;
  return Number((priceMinor * BigInt(count)) / 1_000_000n);
};

export const itemOperation = (item = {}) => {
  const operation = String(item.operation ?? item.fulfillmentOperation ?? '').toLowerCase();
  if (operation === 'esim' || operation === 'new_subscription') return 'esim';
  if (operation === 'topup') return 'topup';
  if (operation === 'physical_sim' || operation === 'sim') return 'physical_sim';
  if (operation === 'device_sale' || operation === 'device') return 'device_sale';
  return operation;
};

export const isEligibleItem = (item = {}, orderCurrency = 'VND') => {
  const currency = String(item.currency ?? orderCurrency ?? '').toUpperCase();
  const excluded = item.loyaltyExcluded === true || item.excludedFromLoyalty === true || ['excluded', 'promo_only'].includes(String(item.type ?? '').toLowerCase());
  const points = calculateEarnPoints({ unitPrice: item.unitPrice ?? item.price, quantity: item.quantity, currency });
  return { eligible: currency === 'VND' && !excluded && points > 0, currency, points };
};

export const requiredMilestoneFor = (item) => MILESTONES[itemOperation(item)] ?? null;

export const publicRule = (rule = {}) => ({
  id: rule.ruleId ?? rule.rule_id ?? 'catalog_fulfillment',
  version: rule.version ?? 'v1',
  currency: 'VND',
  earnBasis: 'eligible_item_subtotal',
  pointsPer: '1 point / 10,000 VND',
  rounding: 'floor',
  milestones: { ...MILESTONES },
  redemption: 'unavailable',
  expiry: 'none',
});

export { MILESTONES };
