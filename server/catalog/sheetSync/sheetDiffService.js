import { SHEET_SYNC_FIELDS } from './sheetSyncTypes.js';

const currentValue = (field, variant, offer) => {
  if (field === 'apn') return offer?.apnHint;
  if (field === 'networkLabel') return offer?.networkLabel ?? variant.networkLabel;
  if (field === 'publicNote') return variant.publicNote;
  return variant[field];
};

export const createSheetDiff = ({ row, variant, offer }) => Object.fromEntries(
  SHEET_SYNC_FIELDS.flatMap((field) => {
    const after = row.normalizedData[field];
    if (after === undefined) return [];
    const before = currentValue(field, variant, offer);
    return [[field, { before: before ?? null, after: after ?? null, changed: before !== after }]];
  }),
);

export const changedSheetFields = (diff) => Object.entries(diff)
  .filter(([, change]) => change.changed)
  .map(([field]) => field);
