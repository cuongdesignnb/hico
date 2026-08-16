import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import { createCatalogAuditRepository } from '../write/catalogAuditRepository.js';
import { createCatalogCommandService } from '../write/catalogCommandService.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { defaultUploadsDirectory, readJson } from '../write/catalogWritePersistence.js';
import { cloneSeedCategories } from '../categories/catalogCategories.js';

const currentVersion = (manifest) => manifest?.versionId ?? manifest?.migrationId ?? null;
const confirmation = 'XOA TOAN BO SAN PHAM';

export class CatalogResetError extends Error {
  constructor(message, { code = 'CATALOG_RESET_FAILED', status = 400, details } = {}) {
    super(message);
    this.name = 'CatalogResetError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const countLinkedMedia = (products = []) => {
  const ids = new Set();
  let references = 0;
  for (const product of products) {
    for (const value of [product.primaryMediaId, ...(product.galleryMediaIds ?? [])]) {
      if (typeof value === 'string' && value) {
        ids.add(value);
        references += 1;
      }
    }
  }
  return { references, unique: ids.size };
};

export const createCatalogResetService = ({
  canonicalRepository = createCanonicalCatalogRepository(),
  commitService = createCatalogVersionCommitService(),
  auditRepository = createCatalogAuditRepository(),
  commandService = createCatalogCommandService(),
  providerRepository = createProviderOfferRepository(),
  uploadsDirectory = defaultUploadsDirectory,
  now = () => new Date(),
  idFactory = (prefix) => `${prefix}-${randomUUID()}`,
} = {}) => {
  const readContext = async () => {
    const [catalog, providerOffers, manualQrs] = await Promise.all([
      canonicalRepository.readCatalog({ required: true }),
      providerRepository.listOffers(),
      readJson(path.join(uploadsDirectory, 'manual_qrs.json'), []),
    ]);
    return { ...catalog, providerOffers, manualQrs };
  };

  return {
    async preview() {
      const context = await readContext();
      const linkedMedia = countLinkedMedia(context.products);
      return {
        currentVersionId: currentVersion(context.manifest),
        products: context.products.length,
        variants: context.variants.length,
        linkedMedia: linkedMedia.unique,
        mediaReferences: linkedMedia.references,
        after: { products: 0, variants: 0 },
        preserved: {
          categories: context.categories.length,
          providerOffers: context.providerOffers.length,
          manualQrs: context.manualQrs.length,
          mediaDeleted: 0,
          orders: true,
          customers: true,
          catalogVersions: true,
        },
        confirmation,
      };
    },

    reset({ request = {}, actor = {} } = {}) {
      return commandService.execute({
        operation: 'CATALOG_RESET',
        idempotencyKey: request.idempotencyKey,
        request,
        handler: async ({ commandId, requestHash }) => {
          if (request.confirmation !== confirmation) throw new CatalogResetError(`Vui lòng nhập chính xác: ${confirmation}.`, { code: 'CATALOG_RESET_CONFIRMATION_REQUIRED', status: 422 });
          const context = await readContext();
          const requestedVersion = String(request.catalogVersionId ?? '').trim();
          if (!requestedVersion || requestedVersion !== currentVersion(context.manifest)) throw new CatalogResetError('Catalog đã thay đổi. Hãy tải lại preview trước khi reset.', { code: 'CATALOG_VERSION_CONFLICT', status: 409 });
          const linkedMedia = countLinkedMedia(context.products);
          const versionId = `catalog-reset-${Date.now()}-${randomUUID().slice(0, 8)}`;
          const createdAt = now().toISOString();
          const audit = {
            id: idFactory('audit'), action: 'CATALOG_RESET', entityType: 'catalog', entityId: versionId,
            actorId: actor.id, actorEmail: actor.email, previousVersionId: requestedVersion, newVersionId: versionId,
            productsRemoved: context.products.length, variantsRemoved: context.variants.length,
            mediaDeleted: 0, mediaReferences: linkedMedia.references, createdAt,
          };
          const committed = await commitService.commit({
            versionId,
            parentVersionId: requestedVersion,
            products: [],
            variants: [],
            categories: context.categories ?? cloneSeedCategories(),
            providerOffers: context.providerOffers,
            manualQrs: context.manualQrs,
            commandType: 'CATALOG_RESET',
            commandId,
            requestHash,
            createdAt,
            beforePointer: () => auditRepository.append(audit),
            rollbackBeforePointer: () => auditRepository.remove(audit.id),
          });
          return {
            status: 200,
            catalogVersionId: committed.manifest.versionId,
            body: {
              reset: true,
              previousVersionId: requestedVersion,
              catalogVersionId: committed.manifest.versionId,
              products: 0,
              variants: 0,
              mediaDeleted: 0,
              warnings: committed.warnings,
            },
          };
        },
      });
    },
  };
};

export { confirmation as CATALOG_RESET_CONFIRMATION };
