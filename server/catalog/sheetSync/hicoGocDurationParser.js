const normalize = (value) => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');

const UNIT_ALIASES = new Map([
  ['ngày', 'day'],
  ['ngay', 'day'],
  ['day', 'day'],
  ['days', 'day'],
  ['tháng', 'month'],
  ['thang', 'month'],
  ['month', 'month'],
  ['months', 'month'],
]);

const displayUnit = (unit) => unit === 'month' ? 'tháng' : 'ngày';

export const parseDurationValue = (value) => {
  const text = normalize(value);
  if (!text) return undefined;
  const match = /^(\d+)\s*([^\d\s]+)?$/i.exec(text);
  if (!match) return undefined;
  const numericValue = Number(match[1]);
  if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 3650) return undefined;
  const unit = UNIT_ALIASES.get(String(match[2] ?? 'ngày').toLocaleLowerCase('vi-VN'));
  if (!unit) return undefined;
  return { value: numericValue, unit, display: `${numericValue} ${displayUnit(unit)}` };
};

export const parseDurationMention = (value) => {
  const text = normalize(value);
  const match = text.match(/(\d+)\s*(ngày|ngay|day|days|tháng|thang|month|months)\b/i);
  return match ? parseDurationValue(`${match[1]} ${match[2]}`) : undefined;
};
