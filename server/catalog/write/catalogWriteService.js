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

const currentVersionId = (manifest) => (
  manifest?.versionId ?? manifest?.migrationId
);

const findById = (items, id) => items.find((item) => item.id === id);

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

const assertUniqueSku = (variants, sku, exceptId) => {
  if (variants.some(
    (variant) => (
      variant.id !== exceptId
      && normalizeSku(variant.sku) === normalizeSku(sku)
    ),
  )) {
    throw new CatalogWriteError('SKU đã tồn tại.', {
      status: 409,
      code: 'SKU_CONFLICT',
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
          if (changes.slug) {
            assertUniqueSlug(context.products, changes.slug, productId);
          }
          const updated = {
            ...existing,
            ...changes,
            version: existing.version + 1,
            updatedAt: now().toISOString(),
          };
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
          const variant = {
            ...input,
            id: input.id ?? idFactory('variant'),
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
          assertUniqueSku(context.variants, variant.sku);
          assertValidEntity(validateVariantRecord({
            variant,
            product,
            providerOffers: context.providerOffers,
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
            assertUniqueSku(context.variants, changes.sku, variantId);
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
