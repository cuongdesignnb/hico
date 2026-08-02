import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mapLegacyCatalog } from '../catalogMapper.js';
import {
  checksumCatalog,
  stableSerialize,
} from '../canonical/canonicalCatalogChecksum.js';
import {
  createCanonicalCatalogRepository,
} from '../canonical/canonicalCatalogRepository.js';
import {
  validateCanonicalCatalog,
} from '../canonical/canonicalCatalogValidation.js';
import { createCatalogParity } from '../canonical/canonicalCatalogParity.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import {
  createReconciliationRepository,
} from '../reconciliation/reconciliationRepository.js';
import {
  validateResolutionForContext,
} from '../reconciliation/reconciliationRules.js';
import { createMigrationReport } from './catalogMigrationReport.js';
import { validateMigrationSources } from './catalogMigrationValidation.js';

const defaultUploadsDirectory = fileURLToPath(
  new URL('../../uploads/', import.meta.url),
);

const WORLD_MOVE_METHODS = new Set([
  'WORLDMOVE_ESIM_REDEEM',
  'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
  'WORLDMOVE_PHYSICAL_ORDER',
  'WORLDMOVE_TOPUP',
]);
const NON_APPLIED_STATUSES = new Set([
  'NOT_FOUND',
  'MISSING_WMPRODUCT_ID',
  'DUPLICATE_PROVIDER_OFFER',
  'TYPE_CONFLICT',
  'LEGACY_CONFLICT',
  'INACTIVE_PROVIDER_OFFER',
  'NEEDS_REVIEW',
  'IGNORED_BY_ADMIN',
]);

const readJsonArray = async (filePath) => {
  const parsed = JSON.parse(await readFile(filePath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`${path.basename(filePath)} must contain an array.`);
  }
  return parsed;
};

export const createMigrationSourceRepository = ({
  uploadsDirectory = defaultUploadsDirectory,
  providerRepository = createProviderOfferRepository({
    offersFile: path.join(uploadsDirectory, 'provider_offers.json'),
  }),
  reconciliationRepository = createReconciliationRepository({
    recordsFile: path.join(uploadsDirectory, 'catalog_reconciliation.json'),
  }),
} = {}) => ({
  async readSources() {
    const [
      destinations,
      packages,
      providerOffers,
      reconciliationRecords,
      manualQrs,
    ] = await Promise.all([
      readJsonArray(path.join(uploadsDirectory, 'destinations.json')),
      readJsonArray(path.join(uploadsDirectory, 'packages.json')),
      providerRepository.listOffers(),
      reconciliationRepository.listRecords(),
      readJsonArray(path.join(uploadsDirectory, 'manual_qrs.json'))
        .catch((error) => (error?.code === 'ENOENT' ? [] : Promise.reject(error))),
    ]);
    return {
      destinations,
      packages,
      providerOffers,
      reconciliationRecords,
      manualQrs,
    };
  },
});

export class CatalogMigrationError extends Error {
  constructor(message, result) {
    super(message);
    this.name = 'CatalogMigrationError';
    this.result = result;
  }
}

const vietnameseSlug = (value) => String(value)
  .replace(/[Đđ]/g, (letter) => (letter === 'Đ' ? 'D' : 'd'))
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'san-pham';

const validSlug = (value) => (
  typeof value === 'string'
  && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
);

const addStableSlugs = (products) => {
  const candidates = products.map((product) => ({
    product,
    base: validSlug(product.slug) && product.slug !== product.id
      ? product.slug
      : vietnameseSlug(product.name),
  }));
  const counts = candidates.reduce((map, item) => {
    map.set(item.base, (map.get(item.base) ?? 0) + 1);
    return map;
  }, new Map());
  const collisions = [];

  return {
    products: candidates.map(({ product, base }) => {
      if (counts.get(base) === 1) return { ...product, slug: base };
      const slug = `${base}-${vietnameseSlug(product.legacyId ?? product.id)}`;
      collisions.push({ id: product.id, baseSlug: base, resolvedSlug: slug });
      return { ...product, slug };
    }),
    collisions,
  };
};

const withoutVersionMetadata = (record) => {
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    version: _version,
    ...business
  } = record;
  return business;
};

const addVersionMetadata = (records, existingRecords, now) => {
  const existingById = new Map(existingRecords.map((item) => [item.id, item]));
  return records.map((record) => {
    const existing = existingById.get(record.id);
    if (
      existing
      && stableSerialize(withoutVersionMetadata(existing))
        === stableSerialize(withoutVersionMetadata(record))
    ) {
      return existing;
    }
    return {
      ...record,
      version: existing ? existing.version + 1 : 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  });
};

const safeLegacyResolution = (variant) => {
  if (
    variant.legacySimType === 'manual'
    || variant.fulfillmentMethod === 'HICO_MANUAL_QR'
  ) {
    return 'HICO_MANUAL_QR';
  }
  if (
    variant.legacySimType === 'physical'
    || variant.fulfillmentMethod === 'HICO_PHYSICAL_STOCK'
  ) {
    return 'HICO_PHYSICAL_STOCK';
  }
  return 'MANUAL_PROCESSING';
};

const applyResolution = ({
  product,
  variant,
  record,
  resolution,
  offer,
}) => {
  validateResolutionForContext({ resolution, product, variant, offer });
  const common = {
    ...variant,
    fulfillmentMethod: resolution,
    needsReview: false,
    ...(record.providerOfferId ? { providerOfferId: record.providerOfferId } : {}),
    ...(record.reviewedBy ? { reviewedBy: record.reviewedBy } : {}),
    ...(record.reviewedAt ? { reviewedAt: record.reviewedAt } : {}),
    reconciliationStatus: record.status,
  };

  if (WORLD_MOVE_METHODS.has(resolution)) {
    return {
      ...common,
      supplier: 'worldmove',
      medium: resolution === 'WORLDMOVE_PHYSICAL_ORDER'
        ? 'physical_sim'
        : resolution === 'WORLDMOVE_TOPUP'
          ? variant.medium
          : 'esim',
      providerOfferId: offer.id,
      providerProductId: offer.providerProductId,
      providerProductType: offer.providerProductType,
      leSIM: offer.leSIM ?? null,
      requiresExistingSim: resolution === 'WORLDMOVE_TOPUP',
    };
  }
  if (resolution === 'HICO_MANUAL_QR') {
    return { ...common, supplier: 'hico', medium: 'esim' };
  }
  if (resolution === 'HICO_PHYSICAL_STOCK') {
    return { ...common, supplier: 'hico', medium: 'physical_sim' };
  }
  return { ...common, supplier: 'other' };
};

const reconcileVariants = ({
  products,
  variants,
  reconciliationRecords,
  providerOffers,
}) => {
  const recordsByVariant = new Map(
    reconciliationRecords.map((record) => [record.variantId, record]),
  );
  const productsById = new Map(products.map((product) => [product.id, product]));
  const offersById = new Map(providerOffers.map((offer) => [offer.id, offer]));
  const warnings = [];
  const stats = { matched: 0, confirmedByAdmin: 0, leftNeedsReview: 0 };

  const resolvedVariants = variants.map((variant) => {
    const record = recordsByVariant.get(variant.id);
    if (!record) {
      if (variant.needsReview) stats.leftNeedsReview += 1;
      return variant;
    }

    if (NON_APPLIED_STATUSES.has(record.status)) {
      stats.leftNeedsReview += 1;
      return {
        ...variant,
        fulfillmentMethod: safeLegacyResolution(variant),
        needsReview: true,
        reconciliationStatus: record.status,
      };
    }

    const resolution = record.status === 'CONFIRMED_BY_ADMIN'
      ? record.confirmedResolution
      : record.suggestedResolution;
    const offer = record.providerOfferId
      ? offersById.get(record.providerOfferId)
      : undefined;
    try {
      const resolved = applyResolution({
        product: productsById.get(variant.productId),
        variant,
        record,
        resolution,
        offer,
      });
      if (record.status === 'MATCHED') stats.matched += 1;
      else stats.confirmedByAdmin += 1;
      return resolved;
    } catch (error) {
      stats.leftNeedsReview += 1;
      warnings.push(
        `Reconciliation ${record.variantId} was not applied: ${error.message}`,
      );
      return {
        ...variant,
        fulfillmentMethod: safeLegacyResolution(variant),
        needsReview: true,
        reconciliationStatus: record.status,
      };
    }
  });

  return { variants: resolvedVariants, stats, warnings };
};

const hasParityFailure = (parity) => (
  parity.missingProductIds.length > 0
  || parity.extraProductIds.length > 0
  || parity.missingVariantIds.length > 0
  || parity.extraVariantIds.length > 0
  || parity.changedSkus.length > 0
  || parity.changedWmproductIds.length > 0
  || parity.changedPrices.length > 0
  || parity.changedCompareAtPrices.length > 0
);

export const createCatalogMigrationService = ({
  sourceRepository = createMigrationSourceRepository(),
  canonicalRepository = createCanonicalCatalogRepository(),
  now = () => new Date(),
} = {}) => {
  const prepare = async () => {
    const startedAt = now().toISOString();
    const sources = await sourceRepository.readSources();
    const sourceValidation = validateMigrationSources(sources);
    if (!sourceValidation.valid) {
      throw new CatalogMigrationError(
        'Migration source validation failed.',
        { errors: sourceValidation.errors },
      );
    }

    const legacy = mapLegacyCatalog(sources);
    const current = await canonicalRepository.readCatalog();
    const slugs = addStableSlugs(legacy.products);
    const reconciled = reconcileVariants({
      products: slugs.products,
      variants: legacy.variants,
      reconciliationRecords: sources.reconciliationRecords,
      providerOffers: sources.providerOffers,
    });
    const timestamp = now().toISOString();
    const products = addVersionMetadata(
      slugs.products,
      current.products,
      timestamp,
    );
    const variants = addVersionMetadata(
      reconciled.variants,
      current.variants,
      timestamp,
    );
    const validation = validateCanonicalCatalog({
      products,
      variants,
      providerOffers: sources.providerOffers,
      manualQrs: sources.manualQrs,
    });
    validation.warnings.push(...reconciled.warnings);
    if (slugs.collisions.length) {
      validation.warnings.push(
        `${slugs.collisions.length} slug collisions received stable suffixes.`,
      );
    }
    const parity = createCatalogParity({
      legacyProducts: legacy.products,
      legacyVariants: legacy.variants,
      canonicalProducts: products,
      canonicalVariants: variants,
      validation,
    });
    if (hasParityFailure(parity)) {
      validation.errors.push('Canonical catalog failed legacy parity checks.');
      validation.valid = false;
    }
    const checksums = checksumCatalog({ products, variants });
    const migrationId = `catalog-${checksums.businessChecksum.slice(0, 20)}`;
    const completedAt = now().toISOString();
    const report = createMigrationReport({
      migrationId,
      startedAt,
      completedAt,
      parity,
      reconciliationApplied: reconciled.stats,
      validation,
      checksums,
      sourceErrors: sourceValidation.errors,
    });
    report.slugCollisions = slugs.collisions;

    return {
      migrationId,
      products,
      variants,
      checksums,
      report,
      sources,
      current,
      completedAt,
    };
  };

  return {
    async validate() {
      const prepared = await prepare();
      return {
        migrationId: prepared.migrationId,
        valid: prepared.report.success,
        products: prepared.products.length,
        variants: prepared.variants.length,
        businessChecksum: prepared.checksums.businessChecksum,
        report: prepared.report,
      };
    },

    async run() {
      const prepared = await prepare();
      if (!prepared.report.success) {
        throw new CatalogMigrationError(
          'Canonical migration validation failed.',
          prepared.report,
        );
      }

      const unchanged = prepared.current.manifest?.businessChecksum
        === prepared.checksums.businessChecksum;
      if (!unchanged) {
        await canonicalRepository.writeVersion({
          migrationId: prepared.migrationId,
          products: prepared.products,
          variants: prepared.variants,
          checksums: prepared.checksums,
          createdAt: prepared.completedAt,
          providerOffers: prepared.sources.providerOffers,
          manualQrs: prepared.sources.manualQrs,
        });
      }
      await canonicalRepository.writeReport(prepared.report);

      return {
        migrationId: prepared.migrationId,
        created: !unchanged,
        unchanged,
        products: prepared.products.length,
        variants: prepared.variants.length,
        businessChecksum: prepared.checksums.businessChecksum,
        report: prepared.report,
      };
    },

    async getStatus() {
      const manifest = await canonicalRepository.readCurrentManifest();
      return {
        migrated: Boolean(manifest),
        source: process.env.CATALOG_READ_SOURCE ?? 'canonical',
        fallback: process.env.CATALOG_CANONICAL_FALLBACK === 'true',
        manifest,
      };
    },

    getReport: (migrationId) => canonicalRepository.findReport(migrationId),
  };
};
