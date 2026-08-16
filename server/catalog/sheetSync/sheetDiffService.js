import { QUICK_SHEET_SYNC_FIELDS, SHEET_SYNC_FIELDS } from './sheetSyncTypes.js';

const currentValue = (field, variant, offer, product) => {
  if (field === 'apn') return offer?.apnHint;
  if (field === 'networkLabel') return offer?.networkLabel ?? variant.networkLabel;
  if (field === 'publicNote') return variant.publicNote;
  if (field === 'productName') return product?.name;
  if (field === 'dataPolicy') return product?.dataPolicy;
  if (field === 'tripDayOptions') return variant.tripDayOptions;
  return variant[field];
};

export const createSheetDiff = ({ row, variant, offer, product }) => Object.fromEntries(
  [...SHEET_SYNC_FIELDS, ...(row.mode === 'quick' ? QUICK_SHEET_SYNC_FIELDS : [])].filter((field, index, fields) => fields.indexOf(field) === index).flatMap((field) => {
    const after = row.normalizedData[field];
    if (after === undefined) return [];
    const before = currentValue(field, variant, offer, product);
    const changed = Array.isArray(before) || Array.isArray(after)
      ? JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)
      : before !== after;
    return [[field, { before: before ?? null, after: after ?? null, changed }]];
  }),
);

export const changedSheetFields = (diff) => Object.entries(diff)
  .filter(([, change]) => change.changed)
  .map(([field]) => field);
