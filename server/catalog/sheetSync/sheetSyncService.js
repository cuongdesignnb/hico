import { createHash, randomUUID } from 'node:crypto';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createSheetReferenceClient } from './sheetReferenceClient.js';
import { parseSheetRows } from './sheetRowParser.js';
import { collapseHicoGocRows, parseHicoGocRows } from './hicoGocParser.js';
import { HICO_GOC_SHEET, hicoGocHeaderHash, normalizeHicoGocSettings } from './hicoGocMapping.js';
import { matchSheetVariant } from './sheetVariantMatcher.js';
import { validateSheetRow } from './sheetFieldValidator.js';
import { createSheetDiff } from './sheetDiffService.js';
import { createSheetApplyService } from './sheetApplyService.js';
import { createFulfillmentProfileRepository } from '../fulfillment/fulfillmentProfileRepository.js';
import { createSheetSyncRepository, publicBatch, publicRow } from './sheetSyncRepository.js';
import { SheetSyncError } from './sheetSyncTypes.js';

const sourceHash = (reference, aliases = [], providerEvidence = [], config = {}) => createHash('sha256').update(JSON.stringify({ spreadsheetId: reference.spreadsheetId, sheetTab: reference.sheetTab, sheetRange: reference.sheetRange, values: reference.values, config, identityAliases: aliases.map((alias) => ({ id: alias.id, normalizedExternalKey: alias.normalizedExternalKey, medium: alias.medium, variantId: alias.variantId, version: alias.version, status: alias.status })).sort((left, right) => left.id.localeCompare(right.id)), providerEvidence: providerEvidence.map((item) => ({ id: item.id ?? null, wmproductId: item.wmproductId ?? null, active: item.active ?? null, version: item.version ?? null, familyKey: item.familyKey ?? null, apnHint: item.apnHint ?? null, networkLabel: item.networkLabel ?? null, providerProductType: item.providerProductType ?? null, leSIM: item.leSIM ?? null })).sort((left, right) => `${left.id}:${left.wmproductId}`.localeCompare(`${right.id}:${right.wmproductId}`)) }), 'utf8').digest('hex');
const summarize = (rows) => ({ total: rows.length, valid: rows.filter((row) => row.status === 'VALID').length, invalid: rows.filter((row) => row.status === 'INVALID').length, changedFields: rows.reduce((count, row) => count + Object.values(row.diff).filter((change) => change.changed).length, 0) });
const providerSnapshotHashFor = (offers, profiles) => createHash('sha256').update(JSON.stringify([...offers, ...profiles].map((item) => ({ id: item.id ?? null, wmproductId: item.wmproductId ?? null, version: item.version ?? null, active: item.active ?? null, apnHint: item.apnHint ?? null, networkLabel: item.networkLabel ?? null, providerProductType: item.providerProductType ?? null, leSIM: item.leSIM ?? null })).sort((left, right) => `${left.id}:${left.wmproductId}`.localeCompare(`${right.id}:${right.wmproductId}`))), 'utf8').digest('hex');
const validatedOfferId = ({ row, matched, offers, profilesByVariant }) => {
  if (!matched?.variant || !matched?.product) return null;
  if (row.normalizedData.wmproductId === undefined && matched.variant.providerOfferId) return matched.variant.providerOfferId;
  const profile = profilesByVariant.get(matched.variant?.id);
  const resolved = validateSheetRow({ row, product: matched.product, variant: matched.variant, offers, fulfillmentProfile: profile, requireExactProvider: row.mode === 'quick' });
  return resolved.offer?.id ?? null;
};

export const createSheetSyncService = ({
  repository = createSheetSyncRepository(), referenceClient = createSheetReferenceClient(), canonicalRepository = createCanonicalCatalogRepository(),
  providerRepository = createProviderOfferRepository(), commitService, fulfillmentProfileRepository = createFulfillmentProfileRepository(), applyService = createSheetApplyService({ canonicalRepository, providerRepository, fulfillmentProfileRepository, ...(commitService ? { commitService } : {}) }),
  variantAliasRepository = null,
  now = () => new Date(), idFactory = () => randomUUID(), logger = console,
} = {}) => ({
  async preview({ actor = {}, mode = 'legacy', settings = {}, onStage = () => {} } = {}) {
    onStage('READING_SHEET');
    const reference = await referenceClient.readRows();
    const quick = mode === 'quick';
    if (quick && reference.sheetTab !== HICO_GOC_SHEET) throw new SheetSyncError(`Quick sync requires the ${HICO_GOC_SHEET} tab.`, { code: 'SHEET_SOURCE_TAB_INVALID', status: 422 });
    const configuredSettings = Object.keys(settings).length ? settings : reference.syncSettings;
    const quickSettings = quick ? normalizeHicoGocSettings(configuredSettings) : null;
    if (quick && (reference.values[0]?.length ?? 0) <= Math.max(...Object.values(quickSettings.fieldMapping))) {
      throw new SheetSyncError('Range HICO GỐC phải bao phủ đến cột WMID (X/Y).', { code: 'SHEET_RANGE_INCOMPLETE', status: 422 });
    }
    if (quick && quickSettings.headerHash && quickSettings.headerHash !== hicoGocHeaderHash(reference.values[0] ?? [])) {
      throw new SheetSyncError('HICO GỐC header đã thay đổi sau khi lưu mapping.', { code: 'SHEET_HEADER_CHANGED', status: 409 });
    }
    const aliases = await (variantAliasRepository?.listActive?.() ?? Promise.resolve([]));
    onStage('LOADING_CATALOG');
    const [catalog, offers, profiles] = await Promise.all([canonicalRepository.readCatalog({ required: true }), providerRepository.listOffers(), fulfillmentProfileRepository.listActive('WORLDMOVE')]);
    const hash = sourceHash(reference, aliases, [...offers, ...profiles], quickSettings ?? { mode });
    const existing = await repository.findBySourceHash(hash);
    if (existing) return { batch: publicBatch(existing), rows: (await repository.listRows(existing.id)).map(publicRow), idempotent: true };
    const profilesByVariant = new Map(profiles.map((profile) => [profile.variantId, profile]));
    onStage('PARSING');
    const parsed = quick
      ? collapseHicoGocRows(parseHicoGocRows(reference.values, quickSettings))
      : parseSheetRows(reference.values);
    const rows = parsed.map((row) => {
      const matched = matchSheetVariant({ row, products: catalog.products, variants: catalog.variants, aliases });
      const errors = [...row.errors];
      let diff = {}; let variantId = null;
      if (matched.error) errors.push(matched.error);
      else {
        variantId = matched.variant.id;
        const validated = validateSheetRow({ row, product: matched.product, variant: matched.variant, offers, fulfillmentProfile: profilesByVariant.get(matched.variant.id) ?? null, requireExactProvider: quick });
        errors.push(...validated.errors);
        diff = createSheetDiff({ row, variant: matched.variant, product: matched.product, offer: validated.offer ?? offers.find((offer) => offer.id === matched.variant.providerOfferId) });
      }
      return { ...row, id: idFactory(), variantId, identityMatch: matched.identityMatch ?? null, status: errors.length ? 'INVALID' : 'VALID', errors, diff, createdAt: now().toISOString(), appliedFields: [], _providerOfferId: validatedOfferId({ row, matched, offers, profilesByVariant }) };
    });
    const targets = new Map();
    for (const row of rows.filter((item) => item.variantId)) {
      const sameTarget = targets.get(row.variantId) ?? [];
      sameTarget.push(row); targets.set(row.variantId, sameTarget);
    }
    for (const sameTarget of targets.values()) if (sameTarget.length > 1) {
      const allTotal = sameTarget.every((row) => row.mode === 'quick' && row.normalizedData.dataPolicy === 'total');
      if (!allTotal) for (const row of sameTarget) { row.status = 'INVALID'; row.errors.push({ code: 'DUPLICATE_TARGET' }); }
    }
    const providerRows = new Map();
    for (const row of rows.filter((item) => item.status === 'VALID' && item._providerOfferId)) {
      const sameOffer = providerRows.get(row._providerOfferId) ?? [];
      sameOffer.push(row); providerRows.set(row._providerOfferId, sameOffer);
    }
    for (const sameOffer of providerRows.values()) {
      const values = ['apn', 'networkLabel'].map((field) => new Set(sameOffer.map((row) => row.normalizedData[field]).filter((value) => value !== undefined)));
      if (values.some((set) => set.size > 1)) for (const row of sameOffer) { row.status = 'INVALID'; row.errors.push({ code: 'PROVIDER_METADATA_CONFLICT' }); }
    }
    rows.forEach((row) => { delete row._providerOfferId; });
    if (quick) {
      const productNames = new Map();
      for (const row of rows.filter((item) => item.status === 'VALID' && item.variantId && item.normalizedData.productName !== undefined)) {
        const product = catalog.products.find((item) => item.id === catalog.variants.find((variant) => variant.id === row.variantId)?.productId);
        if (!product) continue;
        const values = productNames.get(product.id) ?? new Set();
        values.add(row.normalizedData.productName);
        productNames.set(product.id, values);
      }
      for (const [productId, names] of productNames.entries()) if (names.size > 1) {
        for (const row of rows.filter((item) => item.variantId && catalog.variants.find((variant) => variant.id === item.variantId)?.productId === productId)) {
          row.status = 'INVALID';
          row.errors.push({ code: 'PRODUCT_NAME_CONFLICT', field: 'productName' });
        }
      }
    }
    onStage('VALIDATING');
    const summary = summarize(rows);
    const providerSnapshotHash = providerSnapshotHashFor(offers, profiles);
    const batch = { id: idFactory(), mode, sourceHash: hash, providerSnapshotHash, spreadsheetId: reference.spreadsheetId, sheetTab: reference.sheetTab, sheetRange: reference.sheetRange, status: 'READY_FOR_REVIEW', createdBy: actor.id ?? null, createdAt: now().toISOString(), validatedAt: now().toISOString(), catalogVersionId: catalog.manifest?.versionId ?? catalog.manifest?.migrationId ?? null, summary, ...(quickSettings ? { fieldMapping: quickSettings.fieldMapping, priceMapping: quickSettings.priceMapping, headerHash: quickSettings.headerHash } : {}) };
    onStage('PERSISTING');
    await repository.createBatch(batch, rows);
    logger.info?.('[catalog-sheet-sync] preview', { batchId: batch.id, status: batch.status, rowCount: summary.total, matchedCount: summary.valid, errorCount: summary.invalid });
    onStage('COMPLETED');
    return { batch: publicBatch(batch), rows: rows.map(publicRow), idempotent: false };
  },
  async getBatch(id) { const batch = await repository.getBatch(id); if (!batch) throw new SheetSyncError('Sheet batch was not found.', { code: 'SHEET_BATCH_NOT_FOUND', status: 404 }); return publicBatch(batch); },
  async listRows(id, { page, pageSize } = {}) {
    await this.getBatch(id);
    if (page === undefined && pageSize === undefined) return (await repository.listRows(id)).map(publicRow);
    const result = await repository.listRowsPage(id, { page, pageSize });
    return { ...result, items: result.items.map(publicRow) };
  },
  async apply(id, { selection, actor = {} } = {}) {
    const batch = await repository.getBatch(id); if (!batch) throw new SheetSyncError('Sheet batch was not found.', { code: 'SHEET_BATCH_NOT_FOUND', status: 404 });
    if (['APPLIED', 'PARTIALLY_APPLIED'].includes(batch.status)) return { batch: publicBatch(batch), rows: (await repository.listRows(id)).map(publicRow), versionId: batch.catalogVersionId, idempotent: true };
    const reference = await referenceClient.readRows();
    const aliases = await (variantAliasRepository?.listActive?.() ?? Promise.resolve([]));
    const [offers, profiles] = await Promise.all([providerRepository.listOffers(), fulfillmentProfileRepository.listActive('WORLDMOVE')]);
    const config = batch.mode === 'quick'
      ? { fieldMapping: batch.fieldMapping, priceMapping: batch.priceMapping, headerHash: batch.headerHash }
      : { mode: batch.mode ?? 'legacy' };
    const currentHash = sourceHash(reference, aliases, [...offers, ...profiles], config);
    if (currentHash !== batch.sourceHash) throw new SheetSyncError('Sheet, provider snapshot hoặc mapping đã thay đổi sau preview.', { code: 'SHEET_SYNC_STALE_PREVIEW', status: 409 });
    if (batch.providerSnapshotHash && batch.providerSnapshotHash !== providerSnapshotHashFor(offers, profiles)) throw new SheetSyncError('Provider snapshot đã thay đổi sau preview.', { code: 'PROVIDER_SNAPSHOT_CHANGED', status: 409 });
    const claimed = await repository.claimForApply(id, actor.id); if (!claimed) throw new SheetSyncError('Another apply is already running or the batch is no longer reviewable.', { code: 'SHEET_SYNC_APPLY_IN_PROGRESS', status: 409 });
    const rows = await repository.listRows(id);
    let result;
    try { result = await applyService.apply({ batch: claimed, rows, selection, actor }); }
    catch (error) { await repository.updateBatch(id, { status: 'READY_FOR_REVIEW', summary: claimed.summary }); throw error; }
    const appliedAt = now().toISOString(); await repository.updateRows(id, result.applied);
    const nextRows = await repository.listRows(id); const nextBatch = await repository.updateBatch(id, { status: nextRows.some((row) => row.status === 'SKIPPED' || row.status === 'INVALID') ? 'PARTIALLY_APPLIED' : 'APPLIED', summary: { ...batch.summary, ...summarize(nextRows) }, appliedAt, catalogVersionId: result.versionId ?? batch.catalogVersionId });
    logger.info?.('[catalog-sheet-sync] apply', { batchId: id, status: nextBatch.status, rowCount: nextRows.length, appliedCount: Object.values(result.applied).filter((item) => item.status === 'APPLIED').length, approverId: actor.id });
    return { batch: publicBatch(nextBatch), rows: nextRows.map(publicRow), versionId: result.versionId, idempotent: false };
  },
  async reject(id, { actor = {} } = {}) {
    const batch = await repository.getBatch(id); if (!batch) throw new SheetSyncError('Sheet batch was not found.', { code: 'SHEET_BATCH_NOT_FOUND', status: 404 });
    if (batch.status !== 'READY_FOR_REVIEW') throw new SheetSyncError('Sheet batch can no longer be rejected.', { code: 'SHEET_BATCH_NOT_REJECTABLE', status: 409 });
    return { batch: publicBatch(await repository.updateBatch(id, { status: 'REJECTED', summary: batch.summary, rejectedAt: now().toISOString(), rejectedBy: actor.id ?? null })) };
  },
});
