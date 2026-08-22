const normalize = (value) => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
const folded = (value) => normalize(value)
  .toLocaleLowerCase('vi-VN')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const COUNTRY_ALIASES = new Map([
  ['china', 'Trung Quốc'],
  ['mainland china', 'Trung Quốc'],
  ['trung quoc', 'Trung Quốc'],
  ['vietnam', 'Việt Nam'],
  ['viet nam', 'Việt Nam'],
  ['south korea', 'Hàn Quốc'],
  ['korea republic', 'Hàn Quốc'],
  ['han quoc', 'Hàn Quốc'],
  ['japan', 'Nhật Bản'],
  ['nhat ban', 'Nhật Bản'],
]);

const NETWORK_HINTS = new Set([
  'china mobile', 'china unicom', 'china telecom', 'dtac', 'softbank', 'rakuten mobile',
  'vodafone', 'meteor', 'elisa', 'telia', 'tele2', 'lg', 'skt', 'viettel', 'vinaphone',
  'mobifone', 'orange', 'o2', 'ee', 't-mobile', 'tmobile',
]);

const slug = (value) => folded(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'unknown';

const destinationNameFor = (value) => COUNTRY_ALIASES.get(folded(value));
const destinationFor = (value) => {
  const name = destinationNameFor(value);
  return name ? { id: `coverage-${slug(name)}`, name } : null;
};

const splitList = (value) => normalize(value)
  .split(/[,|]/)
  .map((item) => item.trim())
  .filter(Boolean);

const countPrefix = /^(?:\d+)\s+quốc gia\s*\/\s*vùng lãnh thổ\s*:\s*/i;
const autoNetworkPrefix = /^tự động nhận mạng\s*:\s*/i;

export const parseHicoCoverage = (value) => {
  const rawLabel = normalize(value);
  if (!rawLabel) return { rawLabel: '', destinations: [], networks: [], needsReview: true, carrierOnly: false };

  let text = rawLabel;
  let listPrefix = false;
  let networkPrefix = false;
  if (countPrefix.test(text)) {
    text = text.replace(countPrefix, '');
    listPrefix = true;
  } else if (autoNetworkPrefix.test(text)) {
    text = text.replace(autoNetworkPrefix, '');
    listPrefix = true;
    networkPrefix = true;
  }

  const destinations = [];
  const networks = [];
  let structured = false;
  let unresolvedDestination = false;
  const addDestination = (item) => {
    const destination = destinationFor(item);
    if (!destination && normalize(item)) unresolvedDestination = true;
    if (destination && !destinations.some((entry) => entry.id === destination.id)) destinations.push(destination);
  };
  const addNetwork = (item) => {
    const network = normalize(item);
    if (network && !networks.some((entry) => folded(entry) === folded(network))) networks.push(network);
  };

  for (const segment of text.split(';').map((item) => item.trim()).filter(Boolean)) {
    const separator = segment.indexOf(':');
    if (separator > 0) {
      structured = true;
      addDestination(segment.slice(0, separator));
      splitList(segment.slice(separator + 1)).forEach(addNetwork);
      continue;
    }
    const items = splitList(segment);
    if (items.length > 0 && (networkPrefix || !listPrefix) && items.every((item) => NETWORK_HINTS.has(folded(item)))) {
      items.forEach(addNetwork);
      continue;
    }
    items.forEach(addDestination);
  }

  const carrierOnly = destinations.length === 0 && networks.length > 0;
  const needsReview = carrierOnly || unresolvedDestination || (!structured && !listPrefix);
  return { rawLabel, destinations, networks, needsReview, carrierOnly };
};

export const coverageSummaryFor = (parsedCoverage = {}) => ({
  coverageNeedsReview: parsedCoverage.needsReview === true,
  carrierOnlyLabels: parsedCoverage.carrierOnly ? 1 : 0,
  resolvedDestinations: Array.isArray(parsedCoverage.destinations) ? parsedCoverage.destinations.length : 0,
  networks: Array.isArray(parsedCoverage.networks) ? parsedCoverage.networks.length : 0,
});
