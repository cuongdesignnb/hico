import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { sha256 } from '../canonical/canonicalCatalogChecksum.js';
import { assertCanonicalCatalog } from '../canonical/canonicalCatalogValidation.js';
import { categoryById, isLeafCategory } from '../categories/catalogCategories.js';
import { publicSkuForVariantId } from '../public/publicSku.js';
import { createCatalogAuditRepository } from '../write/catalogAuditRepository.js';
import { createCatalogCommandService } from '../write/catalogCommandService.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import { atomicWriteJson, defaultUploadsDirectory, readJson } from '../write/catalogWritePersistence.js';
import {
  CatalogWriteError,
  assertCatalogBaseVersion,
  requireCatalogVersionId,
  requireNonEmptyString,
  requireObject,
} from '../write/catalogWriteValidation.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createEsimSheetReferenceClient } from './esimSheetReferenceClient.js';
import {
  ESIM_SHEET_PARSER_REVISION,
  ESIM_SHEET_SOURCE,
  assertSimHicoReference,
  matchEsimProviderOffer,
  normalizeWmid,
  parseEsimSheetRows,
} from './esimSheetSource.js';

const PREVIEW_TTL = 30 * 60 * 1000;
const currentVersion = (manifest) => manifest?.versionId ?? manifest?.migrationId;
const normalizedText = (value) => String(value ?? '').normalize('NFC').trim();
const familyKeyFor = (row) => normalizedText(row.familyKey || row.productName).replace(/\s+/g, ' ').toLocaleUpperCase('vi-VN');
const slugify = (value) => normalizedText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'esim';
const boolFrom = (value) => {
  const normalized = normalizedText(value).toLocaleLowerCase('vi-VN');
  if (['có', 'có thể', 'co', 'co the', 'yes', 'true', '1'].includes(normalized)) return true;
  if (['không', 'không thể', 'khong', 'khong the', 'no', 'false', '0'].includes(normalized)) return false;
  return undefined;
};
const coverageFor = (row) => ({
  coverageType: ['country', 'region', 'global'].includes(row.coverageType) ? row.coverageType : 'country',
  coverageIds: row.coverageId ? [row.coverageId] : [],
});
const safeRow = (row) => ({
  sourceRowNumber: row.sourceRowNumber,
  wmid: row.wmid,
  productName: row.productName,
  sellingPrice: row.sellingPrice,
  durationDays: row.durationDays,
  tripDayOptions: row.tripDayOptions,
  familyKey: row.familyKey,
  providerStatus: row.providerStatus,
  providerOfferId: row.providerOfferId,
  providerProductType: row.providerProductType,
  leSIM: row.leSIM,
  errors: row.errors,
});

const readContext = async ({ catalogRepository, providerRepository }) => ({
  ...(await catalogRepository.readCatalog({ required: true })),
  providerOffers: await providerRepository.listOffers(),
});

const evaluate = ({ request, context, values }) => {
  const category = categoryById(context.categories, request.categoryId);
  if (!category || category.status !== 'active' || category.kind !== 'esim' || !isLeafCategory(category, context.categories)) {
    throw new CatalogWriteError('Hãy chọn một danh mục eSIM con đang hoạt động.', { code: 'CATEGORY_INVALID' });
  }
  const parsed = parseEsimSheetRows({ values, mapping: request.mapping ?? {} });
  const existingWmids = new Set(context.variants.map((variant) => normalizeWmid(variant.wmproductId)).filter(Boolean));
  const rows = parsed.rows.map((row) => {
    const provider = matchEsimProviderOffer({ wmid: row.wmid, providerOffers: context.providerOffers });
    const errors = [...row.errors];
    if (row.medium !== 'esim') errors.push('MEDIUM_NOT_ESIM');
    if (!row.productName) errors.push('PRODUCT_NAME_REQUIRED');
    if (existingWmids.has(row.wmid)) errors.push('CANONICAL_WMID_CONFLICT');
    if (row.dataPolicy && !['daily', 'total'].includes(row.dataPolicy)) errors.push('DATA_POLICY_INVALID');
    if (row.cancellable !== null && row.cancellable !== undefined && boolFrom(row.cancellable) === undefined) errors.push('CANCELLABLE_INVALID');
    if (provider.status !== 'MATCHED') errors.push(provider.status);
    return {
      ...row,
      familyKey: familyKeyFor(row),
      providerStatus: provider.status,
      providerOfferId: provider.offer?.id ?? null,
      providerProductType: provider.offer?.providerProductType ?? null,
      leSIM: provider.offer?.leSIM ?? null,
      offer: provider.offer,
      errors: [...new Set(errors)],
    };
  });
  const families = new Map();
  for (const row of rows) {
    const family = families.get(row.familyKey) ?? {
      familyKey: row.familyKey,
      productName: row.productName,
      ...coverageFor(row),
      ...(row.coverageLabel ? { coverageLabel: row.coverageLabel } : {}),
      ...(row.dataPolicy ? { dataPolicy: row.dataPolicy } : {}),
      rows: [],
      errors: [],
    };
    if (family.productName !== row.productName) family.errors.push('PRODUCT_NAME_CONFLICT');
    if (family.dataPolicy !== row.dataPolicy) family.errors.push('DATA_POLICY_CONFLICT');
    if (family.coverageLabel !== row.coverageLabel) family.errors.push('COVERAGE_LABEL_CONFLICT');
    if (family.coverageType !== coverageFor(row).coverageType || JSON.stringify(family.coverageIds) !== JSON.stringify(coverageFor(row).coverageIds)) family.errors.push('COVERAGE_CONFLICT');
    family.rows.push(row);
    families.set(row.familyKey, family);
  }
  for (const family of families.values()) {
    family.errors = [...new Set(family.errors)];
    if (family.errors.length) family.rows.forEach((row) => row.errors.push(...family.errors));
  }
  return {
    category,
    parsed,
    rows,
    families: [...families.values()],
    errors: rows.filter((row) => row.errors.length).map((row) => ({ sourceRowNumber: row.sourceRowNumber, wmid: row.wmid, errors: [...new Set(row.errors)] })),
  };
};

const variantFrom = ({ row, productId, timestamp }) => {
  const variantId = `variant-${randomUUID()}`;
  const offer = row.offer;
  const duration = Number.isInteger(row.durationDays) && row.durationDays > 0 ? `${row.durationDays} ngày` : undefined;
  return {
    id: variantId,
    productId,
    sku: `ESIM-SHEET-${sha256(row.wmid).slice(0, 12).toUpperCase()}`,
    publicSku: publicSkuForVariantId(variantId),
    ...(row.dataLimit ? { dataLimit: row.dataLimit } : {}),
    ...(row.dataPolicy ? { dataPolicy: row.dataPolicy } : {}),
    ...(duration ? { duration, durationValue: row.durationDays, durationUnit: 'day' } : {}),
    ...(row.tripDayOptions.length ? { tripDayOptions: row.tripDayOptions } : {}),
    price: row.sellingPrice,
    compareAtPrice: null,
    currency: 'VND',
    medium: 'esim',
    supplier: 'worldmove',
    fulfillmentMethod: offer.leSIM ? 'WORLDMOVE_ESIM_REDEEM' : 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM',
    providerOfferId: offer.id,
    wmproductId: offer.wmproductId,
    providerProductId: offer.providerProductId ?? null,
    providerProductType: 0,
    leSIM: offer.leSIM,
    requiresExistingSim: false,
    shippingRequired: false,
    ...(row.networkLabel ? { networkLabel: row.networkLabel } : {}),
    ...(row.speedLabel ? { speedLabel: row.speedLabel } : {}),
    ...(row.apn ? { apn: row.apn } : {}),
    ...(row.activationPolicy ? { activationPolicy: row.activationPolicy } : {}),
    ...(row.cancellable !== null && row.cancellable !== undefined ? { cancellable: boolFrom(row.cancellable) } : {}),
    ...(row.publicNote ? { publicNote: row.publicNote } : {}),
    stock: null,
    active: false,
    archived: false,
    needsReview: false,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const createEsimSheetSyncService = ({
  env = process.env,
  uploadsDirectory = defaultUploadsDirectory,
  referenceClient = createEsimSheetReferenceClient({ env }),
  catalogRepository,
  providerRepository = createProviderOfferRepository(),
  commitService = createCatalogVersionCommitService({ uploadsDirectory }),
  commandService = createCatalogCommandService({ env }),
  auditRepository = createCatalogAuditRepository({ recordsFile: path.join(uploadsDirectory, 'catalog_audit.json') }),
  now = () => new Date(),
} = {}) => {
  if (!catalogRepository) throw new Error('eSIM Sheet sync requires a canonical catalog repository.');
  const previewsFile = path.join(uploadsDirectory, 'esim_sheet_previews.json');
  const savePreview = async (preview) => {
    const records = await readJson(previewsFile, []);
    await atomicWriteJson(previewsFile, [...records.filter((item) => Date.parse(item.expiresAt) > Date.now() && item.previewId !== preview.previewId), preview]);
  };
  const getPreview = async (previewId) => {
    const preview = (await readJson(previewsFile, [])).find((item) => item.previewId === previewId);
    if (!preview || Date.parse(preview.expiresAt) <= Date.now()) throw new CatalogWriteError('eSIM Sheet preview không tồn tại hoặc đã hết hạn.', { status: 404, code: 'ESIM_SHEET_PREVIEW_NOT_FOUND' });
    return preview;
  };
  const readSource = async () => assertSimHicoReference(await referenceClient.readRows());

  return {
    async preview(request = {}, actor = {}) {
      requireObject(request, 'request');
      const catalogVersionId = requireCatalogVersionId(request.catalogVersionId);
      const [reference, context] = await Promise.all([readSource(), readContext({ catalogRepository, providerRepository })]);
      assertCatalogBaseVersion(catalogVersionId, currentVersion(context.manifest));
      const evaluation = evaluate({ request, context, values: reference.values });
      const preview = {
        previewId: `esim-sheet-${randomUUID()}`,
        source: ESIM_SHEET_SOURCE,
        parserRevision: ESIM_SHEET_PARSER_REVISION,
        actorId: actor.id ?? null,
        categoryId: evaluation.category.id,
        catalogVersionId,
        spreadsheetId: reference.spreadsheetId,
        sheetTab: reference.sheetTab,
        sheetRange: reference.sheetRange,
        sourceHash: sha256(reference.values),
        headerHash: evaluation.parsed.headerHash,
        providerSnapshotHash: sha256(context.providerOffers),
        families: evaluation.families,
        rows: evaluation.rows,
        errors: evaluation.errors,
        createdAt: now().toISOString(),
        expiresAt: new Date(Date.now() + PREVIEW_TTL).toISOString(),
      };
      await savePreview(preview);
      return {
        previewId: preview.previewId,
        source: preview.source,
        parserRevision: preview.parserRevision,
        catalogVersionId,
        headerHash: preview.headerHash,
        sourceHash: preview.sourceHash,
        providerSnapshotHash: preview.providerSnapshotHash,
        familyCount: preview.families.length,
        rowCount: preview.rows.length,
        eligible: preview.rows.filter((row) => row.errors.length === 0).length,
        blocked: preview.errors.length,
        families: preview.families.map((family) => ({ familyKey: family.familyKey, productName: family.productName, variants: family.rows.length, coverageType: family.coverageType, coverageIds: family.coverageIds })),
        rows: preview.rows.map(safeRow),
        errors: preview.errors,
        expiresAt: preview.expiresAt,
      };
    },

    apply(request = {}, actor = {}) {
      requireObject(request, 'request');
      const previewId = requireNonEmptyString(request.previewId, 'previewId');
      return commandService.execute({
        operation: `ESIM_SHEET_APPLY:${previewId}`,
        idempotencyKey: request.idempotencyKey,
        request,
        handler: async ({ commandId, requestHash }) => {
          if (request.confirm !== true) throw new CatalogWriteError('Cần xác nhận áp dụng eSIM Sheet.', { code: 'ESIM_SHEET_CONFIRM_REQUIRED' });
          const preview = await getPreview(previewId);
          const reference = await readSource();
          const context = await readContext({ catalogRepository, providerRepository });
          assertCatalogBaseVersion(request.catalogVersionId, currentVersion(context.manifest));
          if (
            preview.catalogVersionId !== request.catalogVersionId
            || preview.sourceHash !== sha256(reference.values)
            || preview.headerHash !== parseEsimSheetRows({ values: reference.values, mapping: request.mapping ?? {} }).headerHash
            || preview.providerSnapshotHash !== sha256(context.providerOffers)
          ) throw new CatalogWriteError('eSIM Sheet, provider snapshot hoặc catalog đã thay đổi. Hãy preview lại.', { status: 409, code: 'ESIM_SHEET_PREVIEW_STALE' });
          if (preview.errors.length) throw new CatalogWriteError('eSIM Sheet còn dòng bị chặn.', { status: 409, code: 'ESIM_SHEET_APPLY_BLOCKED', details: { errors: preview.errors.slice(0, 100) } });
          const timestamp = now().toISOString();
          const products = [...context.products];
          const variants = [...context.variants];
          for (const family of preview.families) {
            const productId = `product-${randomUUID()}`;
            const product = {
              id: productId,
              slug: `${slugify(family.productName)}-${sha256(family.familyKey).slice(0, 8)}`,
              name: family.productName,
              operation: 'new_subscription',
              categoryId: preview.categoryId,
              categoryNeedsReview: false,
              coverageType: family.coverageType,
              coverageIds: family.coverageIds,
              ...(family.coverageLabel ? { coverageLabel: family.coverageLabel } : {}),
              ...(family.dataPolicy ? { dataPolicy: family.dataPolicy } : {}),
              featured: false,
              status: 'draft',
              version: 1,
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            products.push(product);
            family.rows.forEach((row) => variants.push(variantFrom({ row, productId, timestamp })));
          }
          assertCanonicalCatalog({ products, variants, categories: context.categories, providerOffers: context.providerOffers });
          const versionId = `catalog-esim-sheet-${Date.now()}-${randomUUID().slice(0, 8)}`;
          const audit = {
            id: `audit-${randomUUID()}`,
            actorId: actor.id ?? null,
            action: 'ESIM_SHEET_APPLY',
            entityType: 'catalog_esim_sheet',
            entityId: previewId,
            changedFields: ['products', 'variants'],
            catalogVersionBefore: currentVersion(context.manifest),
            catalogVersionAfter: versionId,
            createdAt: timestamp,
          };
          const committed = await commitService.commit({
            versionId,
            parentVersionId: currentVersion(context.manifest),
            products,
            variants,
            categories: context.categories,
            providerOffers: context.providerOffers,
            commandType: 'ESIM_SHEET_APPLY',
            commandId,
            requestHash,
            createdAt: timestamp,
            beforePointer: () => auditRepository.append(audit),
            rollbackBeforePointer: () => auditRepository.remove(audit.id),
          });
          return {
            status: 201,
            catalogVersionId: committed.manifest.versionId,
            body: {
              previewId,
              productsCreated: preview.families.length,
              variantsCreated: preview.rows.length,
              status: 'DRAFTS_CREATED',
              catalogVersionId: committed.manifest.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },
  };
};
