import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { assertCanonicalCatalog } from '../canonical/canonicalCatalogValidation.js';
import { applySkuConflictMetadata } from '../canonical/canonicalSkuConflicts.js';
import { sha256, stableSerialize } from '../canonical/canonicalCatalogChecksum.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createCatalogAuditRepository } from '../write/catalogAuditRepository.js';
import { createCatalogCommandService } from '../write/catalogCommandService.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import {
  assertCanonicalWriteSource,
  assertCatalogBaseVersion,
  CatalogWriteError,
  changedFields,
  requireCatalogVersionId,
  requireIdempotencyKey,
  requireNonEmptyString,
  requireObject,
} from '../write/catalogWriteValidation.js';
import {
  atomicWriteJson,
  defaultUploadsDirectory,
  readJson,
} from '../write/catalogWritePersistence.js';
import {
  applyBulkOperation,
  normalizeBulkOperation,
} from './catalogBulkOperations.js';
import {
  normalizeBulkEntityType,
  resolveBulkSelection,
} from './catalogBulkSelection.js';

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const SAMPLE_SIZE = 50;

const nowIso = () => new Date().toISOString();

const currentVersionId = (manifest) => manifest?.versionId ?? manifest?.migrationId;

const actorDetails = (actor) => ({
  id: actor?.id ?? null,
  role: actor?.role ?? null,
});

const safeValue = (value) => {
  if (value === undefined) return null;
  if (typeof value === 'string' && value.length > 200) return `${value.slice(0, 197)}...`;
  return value;
};

const createService = ({
  env = process.env,
  uploadsDirectory = defaultUploadsDirectory,
  catalogRepository = createCanonicalCatalogRepository({ uploadsDirectory }),
  providerOfferRepository = createProviderOfferRepository(),
  commandService = createCatalogCommandService({ env }),
  commitService = createCatalogVersionCommitService({ uploadsDirectory }),
  auditRepository = createCatalogAuditRepository({
    recordsFile: path.join(uploadsDirectory, 'catalog_audit.json'),
  }),
} = {}) => {
  const previewsFile = path.join(uploadsDirectory, 'catalog_bulk_previews.json');

  const readContext = async () => {
    const catalog = await catalogRepository.readCatalog({ required: true });
    const providerOffers = await providerOfferRepository.listOffers();
    const manualQrs = await readJson(path.join(uploadsDirectory, 'manual_qrs.json'), []);
    return { ...catalog, providerOffers, manualQrs };
  };

  const readPreviews = async () => readJson(previewsFile, []);

  const savePreview = async (preview) => {
    const previews = await readPreviews();
    const active = previews
      .filter((item) => Date.parse(item.expiresAt) > Date.now())
      .filter((item) => item.previewId !== preview.previewId);
    active.push(preview);
    await atomicWriteJson(previewsFile, active);
  };

  const getPreview = async (previewId) => {
    const preview = (await readPreviews()).find((item) => item.previewId === previewId);
    if (!preview) {
      throw new CatalogWriteError('Không tìm thấy hoặc preview đã hết hạn.', {
        status: 404,
        code: 'BULK_PREVIEW_NOT_FOUND',
      });
    }
    if (Date.parse(preview.expiresAt) <= Date.now()) {
      throw new CatalogWriteError('Preview bulk đã hết hạn.', {
        status: 409,
        code: 'BULK_PREVIEW_EXPIRED',
      });
    }
    return preview;
  };

  const evaluate = ({ entityType, ids, operation, products, variants, providerOffers }) => {
    const productById = new Map(products.map((product) => [product.id, product]));
    const entityList = entityType === 'product' ? products : variants;
    const entityById = new Map(entityList.map((entity) => [entity.id, entity]));
    const errors = [];
    const warnings = [];
    const changes = [];
    const nextProducts = products.map((product) => ({ ...product }));
    const nextVariants = variants.map((variant) => ({ ...variant }));
    const nextProductById = new Map(nextProducts.map((product) => [product.id, product]));
    const nextVariantById = new Map(nextVariants.map((variant) => [variant.id, variant]));

    for (const id of ids) {
      const entity = entityById.get(id);
      if (!entity) {
        errors.push({ id, errors: [{ code: 'ENTITY_NOT_FOUND', message: 'Bản ghi không còn tồn tại.' }] });
        continue;
      }
      const product = entityType === 'variant' ? productById.get(entity.productId) : entity;
      const result = applyBulkOperation({
        entityType,
        entity,
        product,
        products: nextProducts,
        variants: nextVariants,
        operation,
        providerOffers,
      });
      if (result.errors.length) errors.push({
        id,
        errors: result.errors,
      });
      warnings.push(...result.warnings);
      const target = entityType === 'product' ? nextProductById.get(id) : nextVariantById.get(id);
      if (result.errors.length === 0 && result.changedFields.length) {
        Object.assign(target, result.next);
        changes.push({
          id,
          productId: entityType === 'variant' ? entity.productId : undefined,
          label: entityType === 'product' ? entity.name : entity.sku,
          changedFields: result.changedFields,
          before: Object.fromEntries(result.changedFields.map((field) => [field, safeValue(entity[field])])),
          after: Object.fromEntries(result.changedFields.map((field) => [field, safeValue(result.next[field])])),
        });
      }
    }

    return {
      products: nextProducts,
      variants: nextVariants,
      errors,
      warnings: [...new Map(warnings.map((warning) => [
        `${warning.code ?? 'WARNING'}:${warning.message ?? warning}`,
        typeof warning === 'string' ? { code: 'WARNING', message: warning } : warning,
      ])).values()],
      changes,
      eligible: ids.length - errors.length,
      blocked: errors.length,
    };
  };

  const snapshotEntities = (ids, entityType, products, variants) => {
    const list = entityType === 'product' ? products : variants;
    return ids.map((id) => {
      const entity = list.find((item) => item.id === id);
      return { id, entityHash: sha256(entity) };
    });
  };

  const assertPreviewFresh = async ({ preview, request, context, selection }) => {
    const versionId = currentVersionId(context.manifest);
    if (
      versionId !== preview.catalogVersionId
      || request.catalogVersionId !== preview.catalogVersionId
      || request.selectionHash !== preview.selectionHash
      || selection.selectionHash !== preview.selectionHash
    ) {
      throw new CatalogWriteError('Preview không còn khớp với catalog hiện tại.', {
        status: 409,
        code: 'BULK_PREVIEW_STALE',
      });
    }
    const snapshots = snapshotEntities(
      selection.ids,
      preview.entityType,
      context.products,
      context.variants,
    );
    if (stableSerialize(snapshots) !== stableSerialize(preview.entitySnapshots)) {
      throw new CatalogWriteError('Bản ghi đã thay đổi sau khi preview.', {
        status: 409,
        code: 'BULK_PREVIEW_STALE',
      });
    }
    const providerSnapshotHash = sha256(context.providerOffers);
    if (providerSnapshotHash !== preview.providerSnapshotHash) {
      throw new CatalogWriteError('Provider mapping đã thay đổi sau khi preview.', {
        status: 409,
        code: 'BULK_PREVIEW_STALE',
      });
    }
  };

  const makePreviewResponse = ({ preview, evaluation }) => ({
    previewId: preview.previewId,
    catalogVersionId: preview.catalogVersionId,
    selectionHash: preview.selectionHash,
    matchedCount: preview.ids.length,
    eligible: evaluation.eligible,
    blocked: evaluation.blocked,
    warnings: evaluation.warnings,
    changes: evaluation.changes.slice(0, SAMPLE_SIZE),
    errors: evaluation.errors.slice(0, SAMPLE_SIZE),
    expiresAt: preview.expiresAt,
  });

  const preview = async (request, actor = {}) => {
    assertCanonicalWriteSource(env);
    requireObject(request, 'bulk request');
    requireIdempotencyKey(request.idempotencyKey);
    const entityType = normalizeBulkEntityType(request.entityType);
    const operation = normalizeBulkOperation(request.operation);
    const catalogVersionId = requireCatalogVersionId(request.catalogVersionId);
    const context = await readContext();
    assertCatalogBaseVersion(catalogVersionId, currentVersionId(context.manifest));
    const selection = resolveBulkSelection({
      entityType,
      selection: request.selection,
      products: context.products,
      variants: context.variants,
    });
    const evaluation = evaluate({
      entityType,
      ids: selection.ids,
      operation,
      products: context.products,
      variants: context.variants,
      providerOffers: context.providerOffers,
    });
    const previewRecord = {
      previewId: `bulk-preview-${randomUUID()}`,
      actor: actorDetails(actor),
      entityType,
      operation,
      selection: request.selection,
      ids: selection.ids,
      selectionHash: selection.selectionHash,
      catalogVersionId,
      entitySnapshots: snapshotEntities(selection.ids, entityType, context.products, context.variants),
      providerSnapshotHash: sha256(context.providerOffers),
      readinessSnapshotHash: sha256({ errors: evaluation.errors, warnings: evaluation.warnings }),
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(),
    };
    await savePreview(previewRecord);
    return makePreviewResponse({ preview: previewRecord, evaluation });
  };

  const execute = async (request, actor = {}) => {
    requireObject(request, 'bulk execute request');
    const previewId = requireNonEmptyString(request.previewId, 'previewId');
    const idempotencyKey = requireIdempotencyKey(request.idempotencyKey);
    return commandService.execute({
      operation: `BULK_EXECUTE:${previewId}`,
      idempotencyKey,
      request,
      handler: async ({ commandId, requestHash }) => {
        const previewRecord = await getPreview(previewId);
        if (request.confirm !== true) {
          throw new CatalogWriteError('Cần xác nhận execute preview.', {
            status: 400,
            code: 'BULK_CONFIRM_REQUIRED',
          });
        }
        const context = await readContext();
        const selection = resolveBulkSelection({
          entityType: previewRecord.entityType,
          selection: previewRecord.selection,
          products: context.products,
          variants: context.variants,
        });
        await assertPreviewFresh({ preview: previewRecord, request, context, selection });
        const evaluation = evaluate({
          entityType: previewRecord.entityType,
          ids: selection.ids,
          operation: previewRecord.operation,
          products: context.products,
          variants: context.variants,
          providerOffers: context.providerOffers,
        });
        if (evaluation.errors.length) {
          throw new CatalogWriteError('Bulk command bị chặn bởi validation.', {
            status: 409,
            code: 'BULK_BLOCKED',
            details: {
              blocked: evaluation.blocked,
              errors: evaluation.errors.slice(0, SAMPLE_SIZE),
            },
          });
        }
        const nextVariants = applySkuConflictMetadata(evaluation.variants);
        assertCanonicalCatalog({
          products: evaluation.products,
          variants: nextVariants,
          categories: context.categories,
          providerOffers: context.providerOffers,
          manualQrs: context.manualQrs,
        });
        const createdAt = nowIso();
        const versionId = `catalog_bulk_${Date.now()}_${randomUUID().slice(0, 8)}`;
        const auditId = `audit-${randomUUID()}`;
        const changedFieldSet = [...new Set(evaluation.changes.flatMap((change) => change.changedFields))].sort();
        const auditRecord = {
          id: auditId,
          entityType: 'bulk',
          entityId: previewId,
          actor: actorDetails(actor),
          operation: previewRecord.operation.type,
          selectionMode: previewRecord.selection.mode,
          selectedCount: selection.ids.length,
          excludedCount: previewRecord.selection.excludedIds?.length ?? 0,
          previewId,
          catalogVersionId: versionId,
          changedFields: changedFieldSet,
          before: evaluation.changes.slice(0, SAMPLE_SIZE).map((change) => ({ id: change.id, ...change.before })),
          after: evaluation.changes.slice(0, SAMPLE_SIZE).map((change) => ({ id: change.id, ...change.after })),
          createdAt,
        };
        const commitResult = await commitService.commit({
          versionId,
          parentVersionId: currentVersionId(context.manifest),
          products: evaluation.products,
          variants: nextVariants,
          categories: context.categories,
          commandType: `BULK_${previewRecord.operation.type}`,
          commandId,
          requestHash,
          createdAt,
          providerOffers: context.providerOffers,
          manualQrs: context.manualQrs,
          beforePointer: () => auditRepository.append(auditRecord),
          rollbackBeforePointer: () => auditRepository.remove(auditId),
        });
        return {
          status: 200,
          catalogVersionId: commitResult.manifest.versionId,
          body: {
            previewId,
            catalogVersionId: commitResult.manifest.versionId,
            affectedCount: evaluation.changes.length,
            changes: evaluation.changes.slice(0, SAMPLE_SIZE),
            warnings: [...evaluation.warnings, ...commitResult.warnings],
          },
        };
      },
    });
  };

  const publishEntity = async ({ entityType, id, publish, request, actor }) => {
    const selection = { mode: 'ids', ids: [id] };
    const operation = { type: publish ? 'PUBLISH' : 'UNPUBLISH' };
    const previewBody = await preview({
      ...request,
      entityType,
      operation,
      selection,
      idempotencyKey: `${request.idempotencyKey}:preview`,
    }, actor);
    return execute({
      ...request,
      entityType,
      operation,
      selection,
      previewId: previewBody.previewId,
      catalogVersionId: previewBody.catalogVersionId,
      selectionHash: previewBody.selectionHash,
      confirm: true,
    }, actor);
  };

  return {
    preview,
    execute,
    publishEntity,
    readContext,
  };
};

export const createCatalogBulkService = createService;
