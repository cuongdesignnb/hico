import { createHash } from 'node:crypto';

const BUSINESS_IGNORED_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'migrationId',
]);

const normalizeValue = (value, ignoredKeys) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, ignoredKeys));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !ignoredKeys.has(key))
        .sort()
        .map((key) => [key, normalizeValue(value[key], ignoredKeys)]),
    );
  }

  return value;
};

const sortRecords = (records) => [...records].sort(
  (left, right) => String(left.id).localeCompare(String(right.id)),
);

export const stableSerialize = (value, {
  ignoredKeys = new Set(),
} = {}) => JSON.stringify(normalizeValue(value, ignoredKeys));

export const sha256 = (value) => createHash('sha256')
  .update(typeof value === 'string' ? value : stableSerialize(value))
  .digest('hex');

export const checksumRecords = (records, {
  business = false,
} = {}) => sha256(stableSerialize(sortRecords(records), {
  ignoredKeys: business ? BUSINESS_IGNORED_KEYS : new Set(),
}));

export const checksumCatalog = ({ products, variants, categories = [] }) => {
  const productsChecksum = checksumRecords(products);
  const variantsChecksum = checksumRecords(variants);
  const categoriesChecksum = checksumRecords(categories);
  const productsBusinessChecksum = checksumRecords(products, { business: true });
  const variantsBusinessChecksum = checksumRecords(variants, { business: true });
  const categoriesBusinessChecksum = checksumRecords(categories, { business: true });

  return {
    productsChecksum,
    variantsChecksum,
    categoriesChecksum,
    productsBusinessChecksum,
    variantsBusinessChecksum,
    categoriesBusinessChecksum,
    businessChecksum: sha256(
      `${productsBusinessChecksum}:${variantsBusinessChecksum}:${categoriesBusinessChecksum}`,
    ),
  };
};
