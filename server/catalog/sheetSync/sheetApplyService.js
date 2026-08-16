import { createHash, randomUUID } from 'node:crypto';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import { createCatalogAuditRepository } from '../write/catalogAuditRepository.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { assertCanonicalCatalog } from '../canonical/canonicalCatalogValidation.js';
import { changedSheetFields } from './sheetDiffService.js';
import { QUICK_SHEET_SYNC_FIELDS } from './sheetSyncTypes.js';
import { assertSelection, validateSheetRow } from './sheetFieldValidator.js';
import { SheetSyncError } from './sheetSyncTypes.js';
import { createFulfillmentProfileRepository } from '../fulfillment/fulfillmentProfileRepository.js';

const versionId = () => `catalog-sheet-${Date.now()}-${randomUUID().slice(0, 8)}`;
const currentVersion = (manifest) => manifest?.versionId ?? manifest?.migrationId;
const requestHash = (batchId, rowIds, fields, mode) => createHash('sha256').update(JSON.stringify({ batchId, rowIds, fields, mode }), 'utf8').digest('hex');

export const createSheetApplyService = ({
  canonicalRepository = createCanonicalCatalogRepository(), providerRepository = createProviderOfferRepository(),
  commitService = createCatalogVersionCommitService(), auditRepository = createCatalogAuditRepository(), fulfillmentProfileRepository = createFulfillmentProfileRepository(), now = () => new Date(),
} = {}) => ({
  async apply({ batch, rows, selection = {}, actor = {} }) {
    if (!['READY_FOR_REVIEW', 'APPLYING'].includes(batch.status)) throw new SheetSyncError('Sheet batch is not ready for review.', { code: 'SHEET_BATCH_NOT_READY', status: 409 });
    const context = await canonicalRepository.readCatalog({ required: true });
    if (batch.catalogVersionId !== currentVersion(context.manifest)) throw new SheetSyncError('Catalog changed since preview. Create a new preview.', { code: 'SHEET_SYNC_CONCURRENCY_CONFLICT', status: 409 });
    const [offers, profiles] = await Promise.all([providerRepository.listOffers(), fulfillmentProfileRepository.listActive('WORLDMOVE')]);
    const profilesByVariant = new Map(profiles.map((profile) => [profile.variantId, profile]));
    const selectedRows = selection.rowIds ? rows.filter((row) => selection.rowIds.includes(row.id)) : rows;
    if (!selectedRows.length) throw new SheetSyncError('No Sheet rows selected.', { code: 'SHEET_SELECTION_EMPTY' });
    const selectedFields = assertSelection(selection.fields, batch.mode === 'quick' ? QUICK_SHEET_SYNC_FIELDS : ['price', 'wmproductId', 'apn', 'networkLabel', 'publicNote']);
    const productsById = new Map(context.products.map((product) => [product.id, product]));
    const nextProducts = context.products.map((product) => ({ ...product }));
    const nextVariants = context.variants.map((variant) => ({ ...variant }));
    const nextOffers = offers.map((offer) => ({ ...offer }));
    const applied = {}; const auditChanges = [];
    for (const row of selectedRows) {
      if (row.status !== 'VALID') continue;
      const index = nextVariants.findIndex((variant) => variant.id === row.variantId);
      if (index < 0) continue;
      const variant = nextVariants[index]; const product = productsById.get(variant.productId);
      const validation = validateSheetRow({ row, product, variant, offers: nextOffers, fulfillmentProfile: profilesByVariant.get(variant.id) ?? null, requireExactProvider: batch.mode === 'quick' });
      if (!validation.valid) throw new SheetSyncError('Sheet row became invalid.', { code: 'SHEET_ROW_STALE', status: 409, details: { rowId: row.id } });
      const fields = changedSheetFields(row.diff).filter((field) => selectedFields.includes(field));
      if (!fields.length) { applied[row.id] = { status: 'SKIPPED', appliedFields: [] }; continue; }
      for (const field of fields) {
        const value = row.normalizedData[field];
        if (batch.mode === 'quick' && field === 'productName') {
          const targetProduct = nextProducts.find((item) => item.id === product.id);
          if (targetProduct) targetProduct.name = value;
        }
        if (batch.mode === 'quick' && field === 'dataPolicy') {
          const targetProduct = nextProducts.find((item) => item.id === product.id);
          if (targetProduct) targetProduct.dataPolicy = value;
        }
        if (field === 'price') variant.price = value;
        if (field === 'compareAtPrice') variant.compareAtPrice = value;
        if (batch.mode === 'quick' && ['dataLimit', 'duration', 'tripDayOptions', 'activationPolicy', 'speedLabel', 'cancellable'].includes(field)) variant[field] = value;
        if (field === 'publicNote') variant.publicNote = value;
        if (field === 'wmproductId') { variant.wmproductId = validation.offer.wmproductId; variant.providerOfferId = validation.offer.id; variant.fulfillmentProviderWmproductId = validation.offer.wmproductId; }
        if (field === 'apn' || field === 'networkLabel') {
          const offer = nextOffers.find((item) => item.id === (validation.offer?.id ?? variant.providerOfferId));
          if (!offer) throw new SheetSyncError('Provider offer was not found.', { code: 'PROVIDER_NOT_FOUND', status: 409 });
          if (field === 'apn') offer.apnHint = value;
          else offer.networkLabel = value;
        }
      }
      applied[row.id] = { status: 'APPLIED', appliedFields: fields, appliedAt: now().toISOString() };
      auditChanges.push({ row, fields });
    }
    if (!auditChanges.length) return { versionId: null, applied };
    assertCanonicalCatalog({ products: nextProducts, variants: nextVariants, categories: context.categories, providerOffers: nextOffers });
    const createdAt = now().toISOString(); const newVersion = versionId();
    const audit = { id: `audit-${randomUUID()}`, actorId: actor.id, action: 'CATALOG_SHEET_SYNC_APPLY', entityType: 'catalog_sheet_sync', entityId: batch.id, changedFields: [...new Set(auditChanges.flatMap((item) => item.fields))].sort(), catalogVersionBefore: currentVersion(context.manifest), catalogVersionAfter: newVersion, createdAt };
    await commitService.commit({ versionId: newVersion, parentVersionId: currentVersion(context.manifest), products: nextProducts, variants: nextVariants, categories: context.categories, providerOffers: nextOffers, commandType: 'CATALOG_SHEET_SYNC_APPLY', commandId: batch.id, requestHash: requestHash(batch.id, selectedRows.map((row) => row.id), selectedFields, batch.mode), createdAt,
      beforePointer: async () => { await providerRepository.replaceOffers(nextOffers); await auditRepository.append(audit); },
      rollbackBeforePointer: async () => { await providerRepository.replaceOffers(offers); await auditRepository.remove(audit.id); },
    });
    return { versionId: newVersion, applied };
  },
});
