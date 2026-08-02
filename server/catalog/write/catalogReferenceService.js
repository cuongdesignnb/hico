import path from 'node:path';
import {
  defaultUploadsDirectory,
  readJson,
} from './catalogWritePersistence.js';

const PRODUCT_REFERENCE_FIELDS = new Set([
  'productId',
  'destinationId',
  'packageId',
]);
const VARIANT_REFERENCE_FIELDS = new Set([
  'variantId',
  'sku',
  'wmproductId',
  'providerOfferId',
]);

const countReferences = (value, candidates, allowedFields) => {
  if (Array.isArray(value)) {
    return value.reduce(
      (count, item) => count + countReferences(item, candidates, allowedFields),
      0,
    );
  }
  if (!value || typeof value !== 'object') return 0;

  let count = 0;
  for (const [key, child] of Object.entries(value)) {
    if (allowedFields.has(key) && candidates.has(String(child))) count += 1;
    count += countReferences(child, candidates, allowedFields);
  }
  return count;
};

const DATA_FILES = [
  ['orders', 'orders.json'],
  ['manualQr', 'manual_qrs.json'],
  ['reviews', 'reviews.json'],
  ['promos', 'promos.json'],
  ['reconciliation', 'catalog_reconciliation.json'],
  ['carts', 'carts.json'],
  ['fulfillmentJobs', 'fulfillment_jobs.json'],
  ['topups', 'topups.json'],
];

export const createCatalogReferenceService = ({
  uploadsDirectory = defaultUploadsDirectory,
} = {}) => {
  const readSources = async () => Promise.all(DATA_FILES.map(
    async ([source, file]) => ({
      source,
      records: await readJson(path.join(uploadsDirectory, file), []),
    }),
  ));

  const legacyProductReference = async (productId) => {
    const [destinations, packages] = await Promise.all([
      readJson(path.join(uploadsDirectory, 'destinations.json'), []),
      readJson(path.join(uploadsDirectory, 'packages.json'), []),
    ]);
    return [...destinations, ...packages].some((item) => item.id === productId);
  };

  const legacyVariantReference = async (variantId) => {
    const [destinations, packages] = await Promise.all([
      readJson(path.join(uploadsDirectory, 'destinations.json'), []),
      readJson(path.join(uploadsDirectory, 'packages.json'), []),
    ]);
    return [...destinations, ...packages].some(
      (item) => Array.isArray(item.variants)
        && item.variants.some((variant) => variant.id === variantId),
    );
  };

  return {
    async productReferences(product, variants) {
      const references = [];
      const children = variants.filter(
        (variant) => variant.productId === product.id,
      );
      if (children.length) {
        references.push({ source: 'variants', count: children.length });
      }
      if (await legacyProductReference(product.id)) {
        references.push({ source: 'legacyCatalog', count: 1 });
      }
      const candidates = new Set([product.id]);
      for (const source of await readSources()) {
        const count = countReferences(
          source.records,
          candidates,
          PRODUCT_REFERENCE_FIELDS,
        );
        if (count) references.push({ source: source.source, count });
      }
      return references;
    },

    async variantReferences(variant) {
      const references = [];
      if (await legacyVariantReference(variant.id)) {
        references.push({ source: 'legacyCatalog', count: 1 });
      }
      if (variant.providerOfferId || (
        variant.supplier === 'worldmove'
        || variant.supplier === 'local_carrier'
      )) {
        references.push({ source: 'providerMapping', count: 1 });
      }
      const candidates = new Set([
        variant.id,
        variant.sku,
        variant.wmproductId,
        variant.providerOfferId,
      ].filter(Boolean).map(String));
      for (const source of await readSources()) {
        const count = countReferences(
          source.records,
          candidates,
          VARIANT_REFERENCE_FIELDS,
        );
        if (count) references.push({ source: source.source, count });
      }
      return references;
    },
  };
};

