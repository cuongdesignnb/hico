import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import {
  applySkuConflictMetadata,
  normalizeSku,
} from '../canonical/canonicalSkuConflicts.js';
import { assertCanonicalCatalog } from '../canonical/canonicalCatalogValidation.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createCatalogAuditRepository } from './catalogAuditRepository.js';
import { createCatalogCommandService } from './catalogCommandService.js';
import {
  getProductPublishReadiness,
  getVariantPublishReadiness,
} from './catalogPublishReadiness.js';
import {
  normalizeProductInput,
  validateProductRecord,
} from './catalogProductValidation.js';
import { createCatalogReferenceService } from './catalogReferenceService.js';
import { createCatalogSlugHistoryRepository } from './catalogSlugHistoryRepository.js';
import {
  normalizeVariantInput,
  validateVariantRecord,
} from './catalogVariantValidation.js';
import { createCatalogVersionCommitService } from './catalogVersionCommitService.js';
import {
  assertCatalogBaseVersion,
  assertEntityVersion,
  CatalogWriteError,
  changedFields,
  requireCatalogVersionId,
  requireObject,
  requirePositiveVersion,
} from './catalogWriteValidation.js';
import {
  defaultUploadsDirectory,
  readJson,
} from './catalogWritePersistence.js';
import {
  backfillProductCategories,
  categoryById,
  categoryFilterIds,
  categoryPath,
  isLeafCategory,
  operationForCategoryKind,
  projectProductCategory,
} from '../categories/catalogCategories.js';
import {
  backfillVariantPublicSkus,
  publicSkuForVariantId,
} from '../public/publicSku.js';
import {
  assertCategoryCollection,
  normalizeCategoryInput,
} from '../categories/catalogCategoryValidation.js';

const currentVersionId = (manifest) => (
  manifest?.versionId ?? manifest?.migrationId
);

const findById = (items, id) => items.find((item) => item.id === id);

const assertSellableProductOperation = (operation) => {
  if (operation === 'topup') {
    throw new CatalogWriteError('Top-up đã ngừng hỗ trợ cho dữ liệu bán mới.', {
      status: 410,
      code: 'FULFILLMENT_RETIRED',
    });
  }
};

const assertUniqueProductId = (products, id) => {
  if (products.some((product) => product.id === id)) {
    throw new CatalogWriteError('Product ID đã tồn tại.', {
      status: 409,
      code: 'PRODUCT_ID_CONFLICT',
    });
  }
};

const assertUniqueVariantId = (variants, id) => {
  if (variants.some((variant) => variant.id === id)) {
    throw new CatalogWriteError('Variant ID đã tồn tại.', {
      status: 409,
      code: 'VARIANT_ID_CONFLICT',
    });
  }
};

const assertUniqueSlug = (products, slug, exceptId) => {
  if (products.some(
    (product) => product.id !== exceptId && product.slug === slug,
  )) {
    throw new CatalogWriteError('Slug đã tồn tại.', {
      status: 409,
      code: 'SLUG_CONFLICT',
    });
  }
};

const assertValidEntity = (result) => {
  if (!result.valid) {
    throw new CatalogWriteError(
      result.errors[0]?.message ?? 'Dữ liệu catalog không hợp lệ.',
      {
        status: 400,
        code: result.errors[0]?.code ?? 'VALIDATION_ERROR',
        details: {
          errors: result.errors,
          warnings: result.warnings,
        },
      },
    );
  }
};

const assertUniquePublicSku = (variants, publicSku, exceptId) => {
  if (variants.some((variant) => variant.id !== exceptId && variant.publicSku === publicSku)) {
    throw new CatalogWriteError('Public SKU đã tồn tại.', {
      status: 409,
      code: 'PUBLIC_SKU_CONFLICT',
    });
  }
};

const assertProductCategory = (product, categories, { required = false } = {}) => {
  if (!product.categoryId) {
    if (required) {
      throw new CatalogWriteError('Product phải thuộc một danh mục con.', {
        code: 'CATEGORY_REQUIRED',
      });
    }
    return;
  }
  const category = categoryById(categories, product.categoryId);
  if (!category || !isLeafCategory(category, categories)) {
    throw new CatalogWriteError('Danh mục Product không hợp lệ.', {
      code: 'CATEGORY_INVALID',
    });
  }
  if (category.status !== 'active') {
    throw new CatalogWriteError('Danh mục Product đã ngừng sử dụng.', {
      code: 'CATEGORY_ARCHIVED',
    });
  }
  if (operationForCategoryKind(category.kind) !== product.operation) {
    throw new CatalogWriteError('Loại nghiệp vụ không khớp danh mục.', {
      code: 'CATEGORY_OPERATION_MISMATCH',
    });
  }
};

const safeActor = (actor = {}) => ({
  ...(typeof actor.id === 'string' && actor.id
    ? { actorId: actor.id.slice(0, 160) }
    : {}),
  ...(typeof actor.role === 'string' && actor.role
    ? { actorRole: actor.role.slice(0, 80) }
    : {}),
  ...(typeof actor.email === 'string' && actor.email
    ? { actorEmail: actor.email.slice(0, 160) }
    : {}),
  ...(typeof actor.permission === 'string' && actor.permission
    ? { permissionUsed: actor.permission.slice(0, 120) }
    : {}),
  ...(typeof actor.sessionIdHash === 'string' && actor.sessionIdHash
    ? { sessionIdHash: actor.sessionIdHash.slice(0, 80) }
    : {}),
});

export const createCatalogWriteService = ({
  env = process.env,
  canonicalRepository = createCanonicalCatalogRepository(),
  providerRepository = createProviderOfferRepository(),
  commandService = createCatalogCommandService({ env }),
  commitService = createCatalogVersionCommitService(),
  auditRepository = createCatalogAuditRepository(),
  slugHistoryRepository = createCatalogSlugHistoryRepository(),
  referenceService = createCatalogReferenceService(),
  uploadsDirectory = defaultUploadsDirectory,
  mediaAssetRepository = null,
  now = () => new Date(),
  idFactory = (prefix) => `${prefix}-${randomUUID()}`,
  versionIdFactory = () => (
    `catalog-write-${Date.now()}-${randomUUID().slice(0, 8)}`
  ),
} = {}) => {
  const readContext = async () => {
    const [catalog, providerOffers, manualQrs] = await Promise.all([
      canonicalRepository.readCatalog({ required: true }),
      providerRepository.listOffers(),
      readJson(path.join(uploadsDirectory, 'manual_qrs.json'), []),
    ]);
    return { ...catalog, providerOffers, manualQrs };
  };

  const requireBaseVersion = (request, manifest) => {
    const expected = requireCatalogVersionId(request.catalogVersionId);
    assertCatalogBaseVersion(expected, currentVersionId(manifest));
  };

  const assertMediaReferences = async (input = {}) => {
    if (!mediaAssetRepository) return;
    const ids = [
      input.primaryMediaId,
      ...(Array.isArray(input.galleryMediaIds) ? input.galleryMediaIds : []),
    ].filter((id) => typeof id === 'string' && id.trim());
    if (ids.length === 0) return;
    const assets = await mediaAssetRepository.getByIds(ids);
    const known = new Set(assets.map((asset) => asset.id));
    const missing = [...new Set(ids)].filter((id) => !known.has(id));
    if (missing.length > 0) {
      throw new CatalogWriteError('Media reference khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ archive.', {
        status: 400,
        code: 'MEDIA_REFERENCE_INVALID',
        details: { fields: missing.map((id) => id.slice(0, 80)) },
      });
    }
  };

  const commit = async ({
    context,
    products,
    variants,
    categories = context.categories,
    commandType,
    commandId,
    hash,
    audit,
    slugHistory,
    applySkuMetadata = true,
    validateExternalMappings = true,
  }) => {
    const nextVariants = applySkuMetadata
      ? applySkuConflictMetadata(variants)
      : variants;
    assertCanonicalCatalog({
      products,
      variants: nextVariants,
      categories,
      providerOffers: validateExternalMappings
        ? context.providerOffers
        : undefined,
      manualQrs: validateExternalMappings ? context.manualQrs : undefined,
    });
    const createdAt = now().toISOString();
    const versionId = versionIdFactory();
    const auditRecord = {
      id: idFactory('audit'),
      ...safeActor(audit.actor),
      action: commandType,
      entityType: audit.entityType,
      entityId: audit.entityId,
      ...(audit.beforeVersion
        ? { beforeVersion: audit.beforeVersion }
        : {}),
      ...(audit.afterVersion ? { afterVersion: audit.afterVersion } : {}),
      changedFields: [...audit.changedFields].sort(),
      catalogVersionBefore: currentVersionId(context.manifest),
      catalogVersionAfter: versionId,
      createdAt,
    };
    const slugHistoryRecord = slugHistory
      ? {
        id: idFactory('slug-history'),
        entityType: 'product',
        entityId: slugHistory.entityId,
        oldSlug: slugHistory.oldSlug,
        newSlug: slugHistory.newSlug,
        changedAt: createdAt,
        ...(safeActor(audit.actor).actorId
          ? { changedBy: safeActor(audit.actor).actorId }
          : {}),
      }
      : null;
    const committed = await commitService.commit({
      versionId,
      parentVersionId: currentVersionId(context.manifest),
      products,
      variants: nextVariants,
      categories,
      commandType,
      commandId,
      requestHash: hash,
      createdAt,
      providerOffers: validateExternalMappings
        ? context.providerOffers
        : undefined,
      manualQrs: validateExternalMappings ? context.manualQrs : undefined,
      beforePointer: async () => {
        await auditRepository.append(auditRecord);
        if (slugHistoryRecord) {
          await slugHistoryRepository.append(slugHistoryRecord);
        }
      },
      rollbackBeforePointer: async () => {
        if (slugHistoryRecord) {
          await slugHistoryRepository.remove(slugHistoryRecord.id);
        }
        await auditRepository.remove(auditRecord.id);
      },
    });
    return {
      versionId,
      variants: nextVariants,
      warnings: committed.warnings,
    };
  };

  const execute = ({
    operation,
    request,
    actor,
    handler,
  }) => commandService.execute({
    operation,
    idempotencyKey: request.idempotencyKey,
    request,
    handler: (command) => handler({ ...command, actor }),
  });

  return {
    async listCategories() {
      const context = await readContext();
      const projected = context.products.map((product) => projectProductCategory(
        product,
        context.variants,
        context.categories,
      ));
      return {
        items: [...context.categories]
          .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'vi'))
          .map((category) => ({
            ...category,
            path: categoryPath(context.categories, category.id),
            productCount: projected.filter((product) => categoryFilterIds(context.categories, category.id).has(product.categoryId)).length,
          })),
        unresolvedCount: projected.filter((product) => !product.categoryId || product.categoryNeedsReview || product.operationResolution === 'UNRESOLVED').length,
        catalogVersionId: currentVersionId(context.manifest),
      };
    },

    createCategory(request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: 'CREATE_CATEGORY', request, actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const input = normalizeCategoryInput(request.category);
          const timestamp = now().toISOString();
          const category = {
            ...input,
            id: input.id ?? idFactory('category'),
            status: input.status ?? 'active',
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          if (context.categories.some((item) => item.id === category.id)) throw new CatalogWriteError('Category ID đã tồn tại.', { status: 409, code: 'CATEGORY_ID_CONFLICT' });
          if (context.categories.some((item) => item.slug === category.slug)) throw new CatalogWriteError('Category slug đã tồn tại.', { status: 409, code: 'CATEGORY_SLUG_CONFLICT' });
          const categories = [...context.categories, category];
          assertCategoryCollection(categories);
          const committed = await commit({
            context, products: context.products, variants: context.variants, categories,
            commandType: 'CREATE_CATEGORY', commandId, hash,
            audit: { actor, entityType: 'category', entityId: category.id, afterVersion: 1, changedFields: Object.keys(category).filter((field) => !['createdAt', 'updatedAt'].includes(field)) },
          });
          return { status: 201, catalogVersionId: committed.versionId, body: { category, catalogVersionId: committed.versionId, warnings: committed.warnings } };
        },
      });
    },

    updateCategory(categoryId, request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: `UPDATE_CATEGORY:${categoryId}`, request, actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const existing = categoryById(context.categories, categoryId);
          if (!existing) throw new CatalogWriteError('Không tìm thấy category.', { status: 404, code: 'CATEGORY_NOT_FOUND' });
          assertEntityVersion(requirePositiveVersion(request.version), existing.version);
          if (request.changes?.id !== undefined) throw new CatalogWriteError('Không được thay đổi category ID.');
          const changes = normalizeCategoryInput(request.changes, { partial: true });
          const assigned = context.products.some((product) => product.categoryId === categoryId);
          if (assigned && ((changes.kind !== undefined && changes.kind !== existing.kind) || (changes.parentId !== undefined && changes.parentId !== existing.parentId))) {
            throw new CatalogWriteError('Không thể đổi loại hoặc cấp của category đang có Product.', { status: 409, code: 'CATEGORY_IN_USE' });
          }
          if (changes.slug && context.categories.some((item) => item.id !== categoryId && item.slug === changes.slug)) throw new CatalogWriteError('Category slug đã tồn tại.', { status: 409, code: 'CATEGORY_SLUG_CONFLICT' });
          const updated = { ...existing, ...changes, version: existing.version + 1, updatedAt: now().toISOString() };
          const categories = context.categories.map((category) => category.id === categoryId ? updated : category);
          assertCategoryCollection(categories);
          const committed = await commit({
            context, products: context.products, variants: context.variants, categories,
            commandType: 'UPDATE_CATEGORY', commandId, hash,
            audit: { actor, entityType: 'category', entityId: categoryId, beforeVersion: existing.version, afterVersion: updated.version, changedFields: changedFields(existing, updated).filter((field) => !['updatedAt', 'version'].includes(field)) },
          });
          return { status: 200, catalogVersionId: committed.versionId, body: { category: updated, catalogVersionId: committed.versionId, warnings: committed.warnings } };
        },
      });
    },

    setCategoryArchived(categoryId, request, archived, actor) {
      requireObject(request, 'request');
      const action = archived ? 'ARCHIVE_CATEGORY' : 'RESTORE_CATEGORY';
      return execute({
        operation: `${action}:${categoryId}`, request, actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const existing = categoryById(context.categories, categoryId);
          if (!existing) throw new CatalogWriteError('Không tìm thấy category.', { status: 404, code: 'CATEGORY_NOT_FOUND' });
          assertEntityVersion(requirePositiveVersion(request.version), existing.version);
          const affectedIds = new Set([categoryId, ...context.categories.filter((category) => category.parentId === categoryId).map((category) => category.id)]);
          if (archived && context.products.some((product) => affectedIds.has(product.categoryId) && product.status === 'active')) {
            throw new CatalogWriteError('Không thể ngừng category đang có Product active.', { status: 409, code: 'CATEGORY_HAS_ACTIVE_PRODUCTS' });
          }
          if (archived && context.categories.some((category) => category.parentId === categoryId && category.status === 'active')) {
            throw new CatalogWriteError('Hãy ngừng các category con trước.', { status: 409, code: 'CATEGORY_HAS_ACTIVE_CHILDREN' });
          }
          const updated = { ...existing, status: archived ? 'archived' : 'active', version: existing.version + 1, updatedAt: now().toISOString() };
          const categories = context.categories.map((category) => category.id === categoryId ? updated : category);
          assertCategoryCollection(categories);
          const committed = await commit({
            context, products: context.products, variants: context.variants, categories,
            commandType: action, commandId, hash,
            audit: { actor, entityType: 'category', entityId: categoryId, beforeVersion: existing.version, afterVersion: updated.version, changedFields: ['status'] },
          });
          return { status: 200, catalogVersionId: committed.versionId, body: { category: updated, catalogVersionId: committed.versionId, warnings: committed.warnings } };
        },
      });
    },

    async categoryBackfillPreview() {
      const context = await readContext();
      const timestamp = now().toISOString();
      const categoryResult = backfillProductCategories({ products: context.products, variants: context.variants, now: timestamp });
      const skuResult = backfillVariantPublicSkus(context.variants);
      return {
        ...categoryResult.report,
        publicSkusAssigned: skuResult.assigned,
        catalogVersionId: currentVersionId(context.manifest),
      };
    },

    executeCategoryBackfill(request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: 'BACKFILL_CATALOG_TAXONOMY', request, actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const timestamp = now().toISOString();
          const categoryResult = backfillProductCategories({ products: context.products, variants: context.variants, now: timestamp });
          const skuResult = backfillVariantPublicSkus(context.variants);
          const committed = await commit({
            context, products: categoryResult.products, variants: skuResult.variants,
            commandType: 'BACKFILL_CATALOG_TAXONOMY', commandId, hash,
            audit: { actor, entityType: 'catalog', entityId: 'taxonomy-v2', changedFields: ['categories', 'categoryId', 'categoryNeedsReview', 'publicSku'] },
          });
          return { status: 200, catalogVersionId: committed.versionId, body: { ...categoryResult.report, publicSkusAssigned: skuResult.assigned, catalogVersionId: committed.versionId, warnings: committed.warnings } };
        },
      });
    },

    async getProduct(productId) {
      const context = await readContext();
      const product = findById(context.products, productId);
      if (!product) {
        throw new CatalogWriteError('Không tìm thấy product.', {
          status: 404,
          code: 'PRODUCT_NOT_FOUND',
        });
      }
      return {
        product,
        variants: context.variants.filter(
          (variant) => variant.productId === productId,
        ),
        catalogVersionId: currentVersionId(context.manifest),
      };
    },

    async getVariant(productId, variantId) {
      const context = await readContext();
      const product = findById(context.products, productId);
      const variant = findById(context.variants, variantId);
      if (!product || !variant || variant.productId !== productId) {
        throw new CatalogWriteError('Không tìm thấy variant.', {
          status: 404,
          code: 'VARIANT_NOT_FOUND',
        });
      }
      return {
        product,
        variant,
        catalogVersionId: currentVersionId(context.manifest),
      };
    },

    createProduct(request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: 'CREATE_PRODUCT',
        request,
        actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          await assertMediaReferences(request.product);
          const input = normalizeProductInput(request.product);
          assertSellableProductOperation(input.operation);
          const timestamp = now().toISOString();
          const product = {
            ...input,
            id: input.id ?? idFactory('product'),
            featured: input.featured ?? false,
            status: 'draft',
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          assertUniqueProductId(context.products, product.id);
          assertUniqueSlug(context.products, product.slug);
          assertProductCategory(product, context.categories, { required: true });
          assertValidEntity(validateProductRecord(product));
          const products = [...context.products, product];
          const committed = await commit({
            context,
            products,
            variants: context.variants,
            commandType: 'CREATE_PRODUCT',
            commandId,
            hash,
            audit: {
              actor,
              entityType: 'product',
              entityId: product.id,
              afterVersion: 1,
              changedFields: Object.keys(product).filter(
                (field) => !['createdAt', 'updatedAt'].includes(field),
              ),
            },
          });
          return {
            status: 201,
            catalogVersionId: committed.versionId,
            body: {
              product,
              catalogVersionId: committed.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },

    updateProduct(productId, request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: `UPDATE_PRODUCT:${productId}`,
        request,
        actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const existing = findById(context.products, productId);
          if (!existing) {
            throw new CatalogWriteError('Không tìm thấy product.', {
              status: 404,
              code: 'PRODUCT_NOT_FOUND',
            });
          }
          assertEntityVersion(
            requirePositiveVersion(request.version),
            existing.version,
          );
          if (request.changes?.id !== undefined) {
            throw new CatalogWriteError('Không được thay đổi product ID.');
          }
          await assertMediaReferences(request.changes);
          const changes = normalizeProductInput(request.changes, {
            partial: true,
          });
          assertSellableProductOperation(changes.operation);
          if (changes.slug) {
            assertUniqueSlug(context.products, changes.slug, productId);
          }
          const updated = {
            ...existing,
            ...changes,
            version: existing.version + 1,
            updatedAt: now().toISOString(),
          };
          assertSellableProductOperation(updated.operation);
          assertProductCategory(updated, context.categories);
          assertValidEntity(validateProductRecord(updated));
          const products = context.products.map(
            (product) => product.id === productId ? updated : product,
          );
          const productChangedFields = changedFields(existing, updated)
            .filter((field) => !['updatedAt', 'version'].includes(field));
          const committed = await commit({
            context,
            products,
            variants: context.variants,
            commandType: 'UPDATE_PRODUCT',
            commandId,
            hash,
            audit: {
              actor,
              entityType: 'product',
              entityId: productId,
              beforeVersion: existing.version,
              afterVersion: updated.version,
              changedFields: productChangedFields,
            },
            slugHistory: changes.slug && changes.slug !== existing.slug
              ? {
                entityId: productId,
                oldSlug: existing.slug,
                newSlug: changes.slug,
              }
              : undefined,
          });
          return {
            status: 200,
            catalogVersionId: committed.versionId,
            body: {
              product: updated,
              catalogVersionId: committed.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },

    setProductArchived(productId, request, archived, actor) {
      requireObject(request, 'request');
      const action = archived ? 'ARCHIVE_PRODUCT' : 'RESTORE_PRODUCT';
      return execute({
        operation: `${action}:${productId}`,
        request,
        actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const existing = findById(context.products, productId);
          if (!existing) {
            throw new CatalogWriteError('Không tìm thấy product.', {
              status: 404,
              code: 'PRODUCT_NOT_FOUND',
            });
          }
          assertEntityVersion(
            requirePositiveVersion(request.version),
            existing.version,
          );
          const updated = {
            ...existing,
            status: archived ? 'archived' : 'draft',
            version: existing.version + 1,
            updatedAt: now().toISOString(),
          };
          const products = context.products.map(
            (product) => product.id === productId ? updated : product,
          );
          const committed = await commit({
            context,
            products,
            variants: context.variants,
            commandType: action,
            commandId,
            hash,
            audit: {
              actor,
              entityType: 'product',
              entityId: productId,
              beforeVersion: existing.version,
              afterVersion: updated.version,
              changedFields: ['status'],
            },
          });
          return {
            status: 200,
            catalogVersionId: committed.versionId,
            body: {
              product: updated,
              catalogVersionId: committed.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },

    deleteProduct(productId, request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: `DELETE_PRODUCT:${productId}`,
        request,
        actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const existing = findById(context.products, productId);
          if (!existing) {
            throw new CatalogWriteError('Không tìm thấy product.', {
              status: 404,
              code: 'PRODUCT_NOT_FOUND',
            });
          }
          assertEntityVersion(
            requirePositiveVersion(request.version),
            existing.version,
          );
          const references = await referenceService.productReferences(
            existing,
            context.variants,
          );
          if (existing.status !== 'draft' || references.length) {
            throw new CatalogWriteError(
              'Product có reference hoặc không còn draft; hãy archive thay vì xóa.',
              {
                status: 409,
                code: 'REFERENCE_CONFLICT',
                details: { references },
              },
            );
          }
          const products = context.products.filter(
            (product) => product.id !== productId,
          );
          const committed = await commit({
            context,
            products,
            variants: context.variants,
            commandType: 'DELETE_PRODUCT',
            commandId,
            hash,
            audit: {
              actor,
              entityType: 'product',
              entityId: productId,
              beforeVersion: existing.version,
              changedFields: ['deleted'],
            },
          });
          return {
            status: 200,
            catalogVersionId: committed.versionId,
            body: {
              deleted: true,
              productId,
              catalogVersionId: committed.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },

    createVariant(productId, request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: `CREATE_VARIANT:${productId}`,
        request,
        actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const product = findById(context.products, productId);
          if (!product) {
            throw new CatalogWriteError('Không tìm thấy product.', {
              status: 404,
              code: 'PRODUCT_NOT_FOUND',
            });
          }
          if (product.status === 'archived') {
            throw new CatalogWriteError('Không thể thêm variant vào product archived.');
          }
          const input = normalizeVariantInput(request.variant);
          const timestamp = now().toISOString();
          const newVariantId = input.id ?? idFactory('variant');
          const variant = {
            ...input,
            id: newVariantId,
            publicSku: input.publicSku ?? publicSkuForVariantId(newVariantId),
            productId,
            compareAtPrice: input.compareAtPrice ?? null,
            providerProductType: input.providerProductType ?? null,
            leSIM: input.leSIM ?? null,
            requiresExistingSim: input.requiresExistingSim ?? false,
            stock: input.stock ?? null,
            active: false,
            archived: false,
            needsReview: input.fulfillmentMethod === 'MANUAL_PROCESSING'
              ? true
              : input.needsReview ?? false,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          assertUniqueVariantId(context.variants, variant.id);
          assertUniquePublicSku(context.variants, variant.publicSku);
          assertValidEntity(validateVariantRecord({
            variant,
            product,
            providerOffers: context.providerOffers,
            allowLegacy: false,
          }));
          const committed = await commit({
            context,
            products: context.products,
            variants: [...context.variants, variant],
            commandType: 'CREATE_VARIANT',
            commandId,
            hash,
            audit: {
              actor,
              entityType: 'variant',
              entityId: variant.id,
              afterVersion: 1,
              changedFields: Object.keys(variant).filter(
                (field) => !['createdAt', 'updatedAt'].includes(field),
              ),
            },
          });
          return {
            status: 201,
            catalogVersionId: committed.versionId,
            body: {
              variant,
              catalogVersionId: committed.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },

    updateVariant(productId, variantId, request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: `UPDATE_VARIANT:${productId}:${variantId}`,
        request,
        actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const product = findById(context.products, productId);
          const existing = findById(context.variants, variantId);
          if (!product || !existing || existing.productId !== productId) {
            throw new CatalogWriteError('Không tìm thấy variant.', {
              status: 404,
              code: 'VARIANT_NOT_FOUND',
            });
          }
          assertEntityVersion(
            requirePositiveVersion(request.version),
            existing.version,
          );
          if (request.changes?.id !== undefined) {
            throw new CatalogWriteError('Không được thay đổi variant ID.');
          }
          if (request.changes?.publicSku !== undefined) {
            throw new CatalogWriteError('Không được thay đổi public SKU.');
          }
          const changes = normalizeVariantInput(request.changes, {
            partial: true,
          });
          if (changes.sku && normalizeSku(changes.sku) !== normalizeSku(existing.sku)) {
            const references = await referenceService.variantReferences(existing);
            if (references.length) {
              throw new CatalogWriteError(
                'Không thể đổi SKU của variant đã có reference.',
                {
                  status: 409,
                  code: 'REFERENCE_CONFLICT',
                  details: { references },
                },
              );
            }
          }
          const updated = {
            ...existing,
            ...changes,
            version: existing.version + 1,
            updatedAt: now().toISOString(),
          };
          if (
            updated.fulfillmentMethod === 'MANUAL_PROCESSING'
            && (updated.active || !updated.needsReview)
          ) {
            throw new CatalogWriteError(
              'Manual processing phải inactive và needsReview.',
              { code: 'INVALID_MANUAL_PROCESSING' },
            );
          }
          assertValidEntity(validateVariantRecord({
            variant: updated,
            product,
            providerOffers: context.providerOffers,
            allowLegacy: false,
          }));
          const candidateVariants = applySkuConflictMetadata(
            context.variants.map(
              (variant) => variant.id === variantId ? updated : variant,
            ),
          );
          const updatedWithConflicts = findById(candidateVariants, variantId);
          const variantChangedFields = changedFields(
            existing,
            updatedWithConflicts,
          ).filter((field) => !['updatedAt', 'version'].includes(field));
          if (changes.active === true) {
            const readiness = getVariantPublishReadiness({
              variant: updatedWithConflicts,
              product,
              products: context.products,
              variants: candidateVariants,
              providerOffers: context.providerOffers,
              categories: context.categories,
            });
            if (!readiness.publishable) {
              throw new CatalogWriteError(
                'Variant chưa đủ điều kiện publish.',
                {
                  status: 422,
                  code: 'PUBLISH_READINESS_FAILED',
                  details: readiness,
                },
              );
            }
          }
          const committed = await commit({
            context,
            products: context.products,
            variants: candidateVariants,
            commandType: 'UPDATE_VARIANT',
            commandId,
            hash,
            audit: {
              actor,
              entityType: 'variant',
              entityId: variantId,
              beforeVersion: existing.version,
              afterVersion: updated.version,
              changedFields: variantChangedFields,
            },
          });
          return {
            status: 200,
            catalogVersionId: committed.versionId,
            body: {
              variant: findById(committed.variants, variantId),
              catalogVersionId: committed.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },

    setVariantArchived(productId, variantId, request, archived, actor) {
      requireObject(request, 'request');
      const action = archived ? 'ARCHIVE_VARIANT' : 'RESTORE_VARIANT';
      return execute({
        operation: `${action}:${productId}:${variantId}`,
        request,
        actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const existing = findById(context.variants, variantId);
          if (!existing || existing.productId !== productId) {
            throw new CatalogWriteError('Không tìm thấy variant.', {
              status: 404,
              code: 'VARIANT_NOT_FOUND',
            });
          }
          assertEntityVersion(
            requirePositiveVersion(request.version),
            existing.version,
          );
          const updated = {
            ...existing,
            active: false,
            archived,
            version: existing.version + 1,
            updatedAt: now().toISOString(),
          };
          const variants = context.variants.map(
            (variant) => variant.id === variantId ? updated : variant,
          );
          const committed = await commit({
            context,
            products: context.products,
            variants,
            commandType: action,
            commandId,
            hash,
            audit: {
              actor,
              entityType: 'variant',
              entityId: variantId,
              beforeVersion: existing.version,
              afterVersion: updated.version,
              changedFields: ['active', 'archived'],
            },
          });
          return {
            status: 200,
            catalogVersionId: committed.versionId,
            body: {
              variant: findById(committed.variants, variantId),
              catalogVersionId: committed.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },

    deleteVariant(productId, variantId, request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: `DELETE_VARIANT:${productId}:${variantId}`,
        request,
        actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const existing = findById(context.variants, variantId);
          if (!existing || existing.productId !== productId) {
            throw new CatalogWriteError('Không tìm thấy variant.', {
              status: 404,
              code: 'VARIANT_NOT_FOUND',
            });
          }
          assertEntityVersion(
            requirePositiveVersion(request.version),
            existing.version,
          );
          const references = await referenceService.variantReferences(existing);
          if (existing.active || references.length) {
            throw new CatalogWriteError(
              'Variant đang active hoặc có reference; hãy archive thay vì xóa.',
              {
                status: 409,
                code: 'REFERENCE_CONFLICT',
                details: { references },
              },
            );
          }
          const variants = context.variants.filter(
            (variant) => variant.id !== variantId,
          );
          const committed = await commit({
            context,
            products: context.products,
            variants,
            commandType: 'DELETE_VARIANT',
            commandId,
            hash,
            audit: {
              actor,
              entityType: 'variant',
              entityId: variantId,
              beforeVersion: existing.version,
              changedFields: ['deleted'],
            },
          });
          return {
            status: 200,
            catalogVersionId: committed.versionId,
            body: {
              deleted: true,
              variantId,
              catalogVersionId: committed.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },

    async validateProduct(productId) {
      const context = await readContext();
      const product = findById(context.products, productId);
      if (!product) {
        throw new CatalogWriteError('Không tìm thấy product.', {
          status: 404,
          code: 'PRODUCT_NOT_FOUND',
        });
      }
      return {
        productId,
        ...validateProductRecord(product),
        catalogVersionId: currentVersionId(context.manifest),
      };
    },

    async productReadiness(productId) {
      const context = await readContext();
      const product = findById(context.products, productId);
      if (!product) {
        throw new CatalogWriteError('Không tìm thấy product.', {
          status: 404,
          code: 'PRODUCT_NOT_FOUND',
        });
      }
      return {
        productId,
        ...getProductPublishReadiness({
          product,
          products: context.products,
          variants: context.variants,
          providerOffers: context.providerOffers,
          categories: context.categories,
        }),
        catalogVersionId: currentVersionId(context.manifest),
      };
    },

    async variantReadiness(variantId) {
      const context = await readContext();
      const variant = findById(context.variants, variantId);
      const product = variant && findById(context.products, variant.productId);
      if (!variant || !product) {
        throw new CatalogWriteError('Không tìm thấy variant.', {
          status: 404,
          code: 'VARIANT_NOT_FOUND',
        });
      }
      return {
        variantId,
        ...getVariantPublishReadiness({
          variant,
          product,
          products: context.products,
          variants: context.variants,
          providerOffers: context.providerOffers,
          categories: context.categories,
        }),
        catalogVersionId: currentVersionId(context.manifest),
      };
    },

    listVersions: () => commitService.listVersions(),

    async getVersion(versionId) {
      const version = await commitService.readVersion(versionId);
      return {
        manifest: version.manifest,
        products: version.products.length,
        variants: version.variants.length,
        categories: version.categories.length,
      };
    },

    rollback(versionId, request, actor) {
      requireObject(request, 'request');
      return execute({
        operation: `ROLLBACK_CATALOG:${versionId}`,
        request,
        actor,
        handler: async ({ commandId, requestHash: hash }) => {
          const context = await readContext();
          requireBaseVersion(request, context.manifest);
          const target = await commitService.readVersion(versionId);
          const committed = await commit({
            context,
            products: target.products,
            variants: target.variants,
            categories: target.categories,
            commandType: 'ROLLBACK_CATALOG',
            commandId,
            hash,
            audit: {
              actor,
              entityType: 'catalog',
              entityId: versionId,
              changedFields: ['products', 'variants'],
            },
            applySkuMetadata: false,
            validateExternalMappings: false,
          });
          return {
            status: 200,
            catalogVersionId: committed.versionId,
            body: {
              rolledBackFrom: currentVersionId(context.manifest),
              rolledBackTo: versionId,
              catalogVersionId: committed.versionId,
              warnings: committed.warnings,
            },
          };
        },
      });
    },

    listAudit: (filters) => auditRepository.list(filters),
    listEntityAudit: (entityType, entityId, filters) => (
      auditRepository.list({ ...filters, entityType, entityId })
    ),
    listSlugHistory: (productId) => slugHistoryRepository.list(productId),
  };
};
