const text = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim().normalize('NFC');
  return normalized || null;
};

const number = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = text(value);
  if (normalized !== null && /^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return normalized;
};

const boolean = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value === true || value === false) return value;
  const normalized = text(value)?.toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return text(value);
};

const valueFor = (record, names) => {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) return record[name];
  }
  return undefined;
};

const canonicalPayload = (record) => ({
  provider: 'worldmove',
  wmproductId: text(valueFor(record, ['wmproductId', 'WM Product ID'])),
  providerProductId: text(valueFor(record, ['providerProductId', 'Product ID'])),
  providerProductName: text(valueFor(record, ['providerProductName', 'Product Name'])),
  providerProductLanguage: text(valueFor(record, ['providerProductLanguage', 'Product Language'])),
  productRegion: text(valueFor(record, ['productRegion', 'Applicable Region'])),
  providerProductType: number(valueFor(record, ['providerProductType', 'Product Type'])),
  providerCost: number(valueFor(record, ['providerCost', 'Price (wholesaler cost)'])),
  providerCurrency: text(valueFor(record, ['providerCurrency'])) ?? 'TWD',
  cEndPrice: number(valueFor(record, ['cEndPrice', 'C-end Price'])),
  cEndVisible: boolean(valueFor(record, ['cEndVisible', 'C-end Product'])),
  leSIM: boolean(valueFor(record, ['leSIM'])),
});

const fingerprint = (payload) => JSON.stringify(payload);

const blockStartFor = (headers, index) => {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (String(headers[cursor] ?? '').trim().toLowerCase() === 'stt') return cursor;
  }
  return 0;
};

const blockEndFor = (headers, index) => {
  for (let cursor = index + 1; cursor < headers.length; cursor += 1) {
    if (String(headers[cursor] ?? '').trim().toLowerCase() === 'stt') return cursor;
  }
  return headers.length;
};

const columnName = (index) => {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};

export const buildProviderReferenceRecords = ({ headers = [], rows = [] } = {}) => {
  const normalizedHeaders = headers.map((header) => String(header ?? '').trim());
  const wmidColumns = normalizedHeaders
    .map((header, index) => (/^WM Product ID$/i.test(header) ? index : -1))
    .filter((index) => index >= 0);

  return rows.flatMap((cells, rowIndex) => wmidColumns.flatMap((wmidColumn) => {
    const start = blockStartFor(normalizedHeaders, wmidColumn);
    const end = blockEndFor(normalizedHeaders, wmidColumn);
    const record = {};
    for (let index = start; index < end; index += 1) {
      const header = normalizedHeaders[index];
      if (header) record[header] = cells[index];
    }
    const payload = canonicalPayload(record);
    if (!payload.wmproductId) return [];
    return [{
      wmproductId: payload.wmproductId,
      payload,
      sourceRef: `${columnName(wmidColumn)}${rowIndex + 2}`,
    }];
  }));
};

export const discoverProviderReferences = (records = [], targetWmproductIds = []) => {
  const targets = targetWmproductIds.length
    ? targetWmproductIds.map((value) => text(value)).filter(Boolean)
    : [...new Set(records.map((record) => text(record?.wmproductId)).filter(Boolean))];
  const groups = new Map();
  for (const record of records) {
    const wmproductId = text(record?.wmproductId ?? record?.payload?.wmproductId);
    if (!wmproductId) continue;
    const payload = canonicalPayload(record?.payload ?? record);
    const entries = groups.get(wmproductId) ?? [];
    entries.push({ payload, sourceRef: record?.sourceRef ?? null });
    groups.set(wmproductId, entries);
  }

  return targets.map((wmproductId) => {
    const entries = groups.get(wmproductId) ?? [];
    if (!entries.length) {
      return {
        wmproductId,
        status: 'PROVIDER_NOT_FOUND',
        occurrenceCount: 0,
        logicalCandidate: null,
        payloadCandidates: [],
      };
    }

    const byPayload = new Map();
    for (const entry of entries) {
      const key = fingerprint(entry.payload);
      const current = byPayload.get(key) ?? { payload: entry.payload, sourceRefs: [] };
      if (entry.sourceRef) current.sourceRefs.push(entry.sourceRef);
      byPayload.set(key, current);
    }
    const payloadCandidates = [...byPayload.values()].map((candidate) => ({
      payload: candidate.payload,
      occurrenceCount: candidate.sourceRefs.length,
      sourceRefs: candidate.sourceRefs,
    }));

    if (payloadCandidates.length === 1) {
      const [candidate] = payloadCandidates;
      return {
        wmproductId,
        status: entries.length > 1 ? 'DUPLICATE_IDENTICAL_COLLAPSED' : 'MATCHED',
        occurrenceCount: entries.length,
        logicalCandidate: candidate.payload,
        payloadCandidates,
      };
    }

    return {
      wmproductId,
      status: 'PROVIDER_AMBIGUOUS',
      occurrenceCount: entries.length,
      logicalCandidate: null,
      payloadCandidates,
    };
  });
};

export { canonicalPayload };
