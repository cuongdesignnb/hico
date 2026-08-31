const aliases = {
  'sku svl': 'skuPhysical',
  'sku esim': 'skuEsim',
  'giá sim': 'pricePhysical',
  'giá esim': 'priceEsim',
  wmid_sim: 'wmproductIdPhysical',
  wmid_esim: 'wmproductIdEsim',
  apn: 'apn',
  'quốc gia/ nhà mạng': 'networkLabel',
  'quốc gia/nhà mạng': 'networkLabel',
  'ghi chú': 'publicNote',
  ngày: 'durationDays',
  'loại data': 'dataType',
};

export const normalizeHeader = (value) => String(value ?? '')
  .normalize('NFC')
  .trim()
  .toLowerCase()
  .replace(/[\r\n]+/g, ' ')
  .replace(/\s*\/\s*/g, '/')
  .replace(/\s+/g, ' ');

export const resolveSimHicoHeaders = (headers = []) => headers.map((header, index) => ({
  index,
  source: String(header ?? ''),
  normalized: normalizeHeader(header),
  field: aliases[normalizeHeader(header)] ?? null,
}));

export const validateSimHicoHeader = (headers = []) => {
  const resolved = resolveSimHicoHeaders(headers);
  const fields = new Set(resolved.map((item) => item.field).filter(Boolean));
  const missing = [];
  if (!fields.has('durationDays')) missing.push('Ngày');
  if (!fields.has('dataType')) missing.push('Loại data');
  const hasEsim = fields.has('skuEsim') && fields.has('priceEsim');
  const hasPhysical = fields.has('skuPhysical') && fields.has('pricePhysical');
  if (!hasEsim && !hasPhysical) missing.push('SKU ESIM + Giá eSim hoặc SKU SVL + Giá Sim');
  return { valid: missing.length === 0, missing, resolved, hasEsim, hasPhysical, detectedAliases: Object.fromEntries(resolved.filter((item) => item.field).map((item) => [item.source, item.field])) };
};

export const simHicoFieldFor = (headers, field) => resolveSimHicoHeaders(headers).find((item) => item.field === field)?.index;
