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
  commercialPayloadFor,
  matchEsimProviderOffer,
  normalizeWmid,
  parseEsimSheetRows,
  sourceKeyForWmid,
} from './esimSheetSource.js';

const PREVIEW_TTL = 30 * 60 * 1000;
const currentVersion = (manifest) => manifest?.versionId ?? manifest?.migrationId;
const normalizedText = (value) => String(value ?? '').normalize('NFC').trim();
const familyKeyFor = (row) => normalizedText(row.familyKey || row.productName).replace(/\s+/g, ' ').toLocaleUpperCase('vi-VN');
const familySourceKeyFor = (familyKey) => `${ESIM_SHEET_SOURCE}:FAMILY:${sha256(familyKey).slice(0, 24)}`;
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
  sourceRowNumbers: row.sourceRowNumbers ?? [row.sourceRowNumber],
  sourceKey: row.sourceKey ?? null,
  existingVariantId: row.existingVariantId ?? null,
  legacyCollision: row.legacyCollision === true,
  medium: row.medium ?? null,
  status: row.status ?? null,
  skipReason: row.skipReason ?? null,
  wmid: row.wmid,
  productName: row.productName,
  sellingPrice: row.sellingPrice,
  durationDays: row.durationDays,
  tripDayOptions: row.tripDayOptions,
  familyKey: row.familyKey,
  dataLimit: row.dataLimit ?? null,
  dataPolicy: row.dataPolicy ?? null,
  providerStatus: row.providerStatus,
  providerOfferId: row.providerOfferId,
  providerProductType: row.providerProductType,
  leSIM: row.leSIM,
  warnings: row.warnings ?? [],
  errors: row.errors,
});

const readContext = async ({ catalogRepository, providerRepository }) => ({
  ...(await catalogRepository.readCatalog({ required: true })),
  providerOffers: await providerRepository.listOffers(),
});

const stablePayload = (row) => JSON.stringify(commercialPayloadFor(row, row.offer));

const collapseSameWmidRows = (rows) => {
  const groups = new Map();
  rows.forEach((row) => {
    if (!row.wmid) return;
    const group = groups.get(row.wmid) ?? [];
    group.push(row);
    groups.set(row.wmid, group);
  });
  const collapsed = [];
  const conflictWmids = new Set();
  for (const [wmid, group] of groups) {
    const payloads = new Set(group.map(stablePayload));
    if (payloads.size > 1) {
      conflictWmids.add(wmid);
      group.forEach((row) => row.errors.push('SAME_WMID_COMMERCIAL_CONFLICT'));
      collapsed.push(...group);
      continue;
    }
    const first = group[0];
    collapsed.push({
      ...first,
      sourceRowNumbers: group.flatMap((row) => row.sourceRowNumbers ?? [row.sourceRowNumber]),
      tripDayOptions: [...new Set(group.flatMap((row) => row.tripDayOptions ?? []))].sort((left, right) => left - right),
      warnings: [...new Set(group.flatMap((row) => row.warnings ?? []))],
      errors: [...new Set(group.flatMap((row) => row.errors))],
    });
  }
  const withoutWmid = rows.filter((row) => !row.wmid);
  return { rows: [...withoutWmid, ...collapsed], conflictWmids };
};

const evaluate = ({ request, context, values }) => {
  const category = categoryById(context.categories, request.categoryId);
  if (!category || category.status !== 'active' || category.kind !== 'esim' || !isLeafCategory(category, context.categories)) {
    throw new CatalogWriteError('Hãy chọn một danh mục eSIM con đang hoạt động.', { code: 'CATEGORY_INVALID' });
  }
  const parsed = parseEsimSheetRows({ values, mapping: request.mapping ?? {} });
  const rawRows = parsed.rows.map((row) => {
    const isEsim = row.medium === 'esim';
    if (!isEsim) {
      return {
        ...row,
        familyKey: familyKeyFor(row),
        providerStatus: 'SKIPPED_NON_ESIM',
        status: 'SKIPPED_NON_ESIM',
        skipReason: 'SKIPPED_NON_ESIM',
        providerOfferId: null,
        providerProductType: null,
        leSIM: null,
        offer: null,
        sourceKey: null,
        errors: [],
      };
    }
    const provider = matchEsimProviderOffer({ wmid: row.wmid, providerOffers: context.providerOffers });
    const errors = [...row.errors];
    if (!row.productName) errors.push('PRODUCT_NAME_REQUIRED');
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
      sourceKey: sourceKeyForWmid(row.wmid),
      errors: [...new Set(errors)],
    };
  });
  const skippedRows = rawRows.filter((row) => row.status === 'SKIPPED_NON_ESIM');
  const collapsedResult = collapseSameWmidRows(rawRows.filter((row) => row.status !== 'SKIPPED_NON_ESIM'));
  const rows = [...skippedRows, ...collapsedResult.rows];
  const ownVariantsByWmid = new Map();
  for (const variant of context.variants) {
    const wmid = normalizeWmid(variant.wmproductId);
    if (!wmid) continue;
    const variants = ownVariantsByWmid.get(wmid) ?? [];
    variants.push(variant);
    ownVariantsByWmid.set(wmid, variants);
  }
  for (const row of rows.filter((candidate) => candidate.status !== 'SKIPPED_NON_ESIM')) {
    const ownVariants = (ownVariantsByWmid.get(row.wmid) ?? []).filter((variant) => variant.source === ESIM_SHEET_SOURCE);
    const legacyVariants = (ownVariantsByWmid.get(row.wmid) ?? []).filter((variant) => variant.source !== ESIM_SHEET_SOURCE);
    if (ownVariants.length > 1) row.errors.push('SOURCE_WMID_DUPLICATE');
    if (legacyVariants.length) {
      row.errors.push('LEGACY_WMID_COLLISION');
      row.legacyCollision = true;
    }
    row.existingVariantId = ownVariants[0]?.id ?? null;
  }
  const familyKeysByWmid = new Map();
  for (const row of rows.filter((candidate) => candidate.status !== 'SKIPPED_NON_ESIM')) {
    if (!row.wmid) continue;
    const keys = familyKeysByWmid.get(row.wmid) ?? new Set();
    keys.add(familyKeyFor(row));
    familyKeysByWmid.set(row.wmid, keys);
  }
  for (const row of rows.filter((candidate) => candidate.status !== 'SKIPPED_NON_ESIM')) {
    if ((familyKeysByWmid.get(row.wmid)?.size ?? 0) > 1) row.errors.push('SOURCE_WMID_FAMILY_CONFLICT');
    row.errors = [...new Set(row.errors)];
  }
  const families = new Map();
  for (const row of rows.filter((candidate) => candidate.status !== 'SKIPPED_NON_ESIM')) {
    const family = families.get(row.familyKey) ?? {
      familyKey: row.familyKey,
      sourceKey: familySourceKeyFor(row.familyKey),
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
  rows.forEach((row) => {
    if (row.status === 'SKIPPED_NON_ESIM') return;
    row.errors = [...new Set(row.errors)];
    row.status = row.errors.length ? 'BLOCKED' : 'ELIGIBLE';
  });
  const eligibleRows = rows.filter((row) => row.status === 'ELIGIBLE');
  const blockedRows = rows.filter((row) => row.status === 'BLOCKED');
  const warnings = rows
    .filter((row) => row.warnings?.length)
    .map((row) => ({ sourceRowNumbers: row.sourceRowNumbers ?? [row.sourceRowNumber], wmid: row.wmid, warnings: [...new Set(row.warnings)] }));
  return {
    category,
    parsed,
    rows,
    families: [...families.values()],
    eligibleRows,
    blockedRows,
    skippedRows,
    warnings,
    errors: blockedRows.map((row) => ({ sourceRowNumbers: row.sourceRowNumbers ?? [row.sourceRowNumber], wmid: row.wmid, errors: [...new Set(row.errors)] })),
  };
};

const variantFrom = ({ row, productId, timestamp, existing = null }) => {
  const variantId = existing?.id ?? `variant-${randomUUID()}`;
  const offer = row.offer;
  const duration = Number.isInteger(row.durationDays) && row.durationDays > 0 ? `${row.durationDays} ngày` : undefined;
  return {
    ...(existing ?? {}),
    id: variantId,
    productId,
    sku: `ESIM-SHEET-${sha256(row.wmid).slice(0, 12).toUpperCase()}`,
    publicSku: publicSkuForVariantId(variantId),
    ...(row.dataLimit ? { dataLimit: row.dataLimit } : {}),
    ...(row.dataPolicy ? { dataPolicy: row.dataPolicy } : {}),
    ...(duration ? { duration, durationValue: row.durationDays, durationUnit: 'day' } : {}),
    tripDayOptions: [...(row.tripDayOptions ?? [])],
    price: row.sellingPrice,
    compareAtPrice: existing?.compareAtPrice ?? null,
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
    ...(row.resetPolicy ? { resetPolicy: row.resetPolicy } : {}),
    ...(row.cancellable !== null && row.cancellable !== undefined ? { cancellable: boolFrom(row.cancellable) } : {}),
    ...(row.publicNote ? { publicNote: row.publicNote } : {}),
    stock: existing?.stock ?? null,
    active: existing?.active ?? false,
    archived: existing?.archived ?? false,
    needsReview: existing?.needsReview ?? false,
    source: ESIM_SHEET_SOURCE,
    sourceKey: row.sourceKey,
    sourceRowNumbers: row.sourceRowNumbers ?? [row.sourceRowNumber],
    sourceWmid: row.wmid,
    sourceRevision: ESIM_SHEET_PARSER_REVISION,
    version: (existing?.version ?? 0) + 1,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

const productFrom = ({ family, categoryId, timestamp, existing = null }) => ({
  ...(existing ?? {}),
  id: existing?.id ?? `product-${randomUUID()}`,
  slug: existing?.slug ?? `${slugify(family.productName)}-${sha256(family.familyKey).slice(0, 8)}`,
  name: family.productName,
  operation: existing?.operation ?? 'new_subscription',
  categoryId: existing?.categoryId ?? categoryId,
  categoryNeedsReview: false,
  coverageType: family.coverageType,
  coverageIds: family.coverageIds,
  ...(family.coverageLabel ? { coverageLabel: family.coverageLabel } : {}),
  ...(family.dataPolicy ? { dataPolicy: family.dataPolicy } : {}),
  source: ESIM_SHEET_SOURCE,
  sourceKey: family.sourceKey,
  sourceRowNumbers: [...new Set(family.rows.flatMap((row) => row.sourceRowNumbers ?? [row.sourceRowNumber]))],
  sourceRevision: ESIM_SHEET_PARSER_REVISION,
  featured: existing?.featured ?? false,
  status: existing?.status ?? 'draft',
  version: (existing?.version ?? 0) + 1,
  createdAt: existing?.createdAt ?? timestamp,
  updatedAt: timestamp,
});

const sourceVariantFor = (variants, row) => variants.find((variant) => (
  variant.source === ESIM_SHEET_SOURCE && variant.sourceKey === row.sourceKey
)) ?? variants.find((variant) => (
  variant.source === ESIM_SHEET_SOURCE
  && normalizeWmid(variant.sourceWmid ?? variant.wmproductId) === row.wmid
));

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
      const previewRows = evaluation.rows.map(({ offer: _offer, ...row }) => row);
      const previewFamilies = evaluation.families.map(({ rows, ...family }) => ({
        ...family,
        rows: rows.map(({ offer: _offer, ...row }) => row),
      }));
      const preview = {
        previewId: `esim-sheet-${randomUUID()}`,
        source: ESIM_SHEET_SOURCE,
        parserRevision: ESIM_SHEET_PARSER_REVISION,
        actorId: actor.id ?? null,
        categoryId: evaluation.category.id,
        mapping: request.mapping ?? {},
        catalogVersionId,
        spreadsheetId: reference.spreadsheetId,
        sheetTab: reference.sheetTab,
        sheetRange: reference.sheetRange,
        sourceHash: sha256(reference.values),
        headerHash: evaluation.parsed.headerHash,
        providerSnapshotHash: sha256(context.providerOffers),
        families: previewFamilies,
        rows: previewRows,
        errors: evaluation.errors,
        warnings: evaluation.warnings,
        eligible: evaluation.eligibleRows.length,
        blocked: evaluation.blockedRows.length,
        skipped: evaluation.skippedRows.length,
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
        eligible: preview.eligible,
        blocked: preview.blocked,
        skipped: preview.skipped,
        partial: preview.eligible > 0 && preview.blocked > 0,
        families: preview.families.map((family) => ({ familyKey: family.familyKey, productName: family.productName, variants: family.rows.length, coverageType: family.coverageType, coverageIds: family.coverageIds })),
        rows: preview.rows.map(safeRow),
        errors: preview.errors,
        warnings: preview.warnings,
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
            preview.parserRevision !== ESIM_SHEET_PARSER_REVISION
            || preview.catalogVersionId !== request.catalogVersionId
            || preview.sourceHash !== sha256(reference.values)
            || preview.headerHash !== parseEsimSheetRows({ values: reference.values, mapping: request.mapping ?? {} }).headerHash
            || preview.providerSnapshotHash !== sha256(context.providerOffers)
          ) throw new CatalogWriteError('eSIM Sheet, parser, provider snapshot hoặc catalog đã thay đổi. Hãy preview lại.', { status: 409, code: 'ESIM_SHEET_PREVIEW_STALE' });
          const evaluation = evaluate({ request: { ...request, categoryId: preview.categoryId, mapping: request.mapping ?? preview.mapping ?? {} }, context, values: reference.values });
          if (evaluation.eligibleRows.length === 0) {
            if (evaluation.errors.length > 0) {
              throw new CatalogWriteError('eSIM Sheet không có dòng eSIM đủ điều kiện áp dụng.', { status: 409, code: 'ESIM_SHEET_APPLY_BLOCKED', details: { errors: evaluation.errors.slice(0, 100) } });
            }
            return {
              status: 200,
              body: {
                previewId,
                productsCreated: 0,
                productsUpdated: 0,
                variantsCreated: 0,
                variantsUpdated: 0,
                status: 'SYNC_NO_ELIGIBLE_ROWS',
                eligible: 0,
                blocked: 0,
                skipped: evaluation.skippedRows.length,
                warnings: evaluation.warnings,
                errors: [],
              },
            };
          }
          const timestamp = now().toISOString();
          const products = [...context.products];
          const variants = [...context.variants];
          let productsCreated = 0;
          let productsUpdated = 0;
          let variantsCreated = 0;
          let variantsUpdated = 0;
          for (const family of evaluation.families) {
            const eligibleFamilyRows = family.rows.filter((row) => row.status === 'ELIGIBLE');
            if (eligibleFamilyRows.length === 0) continue;
            const eligibleFamily = { ...family, rows: eligibleFamilyRows };
            const existingProduct = products.find((product) => (
              product.source === ESIM_SHEET_SOURCE && product.sourceKey === eligibleFamily.sourceKey
            ));
            const product = productFrom({ family: eligibleFamily, categoryId: preview.categoryId, timestamp, existing: existingProduct });
            if (existingProduct) {
              products[products.findIndex((candidate) => candidate.id === existingProduct.id)] = product;
              productsUpdated += 1;
            } else {
              products.push(product);
              productsCreated += 1;
            }
            for (const row of eligibleFamilyRows) {
              const existingVariant = sourceVariantFor(variants, row);
              const nextVariant = variantFrom({ row, productId: product.id, timestamp, existing: existingVariant });
              if (existingVariant) {
                variants[variants.findIndex((candidate) => candidate.id === existingVariant.id)] = nextVariant;
              variantsUpdated += 1;
              } else {
                variants.push(nextVariant);
              variantsCreated += 1;
              }
            }
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
              productsCreated,
              productsUpdated,
              variantsCreated,
              variantsUpdated,
              eligible: evaluation.eligibleRows.length,
              blocked: evaluation.blockedRows.length,
              skipped: evaluation.skippedRows.length,
              partial: evaluation.blockedRows.length > 0,
              status: 'SYNC_APPLIED',
              catalogVersionId: committed.manifest.versionId,
              errors: evaluation.errors,
              syncWarnings: evaluation.warnings,
              warnings: committed.warnings,
            },
          };
        },
      });
    },
  };
};
