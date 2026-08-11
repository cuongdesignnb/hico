import { SheetSyncError } from '../sheetSync/sheetSyncTypes.js';
import { namespaceForMedium, resolveSheetVariantIdentity } from './variantIdentityResolver.js';
import { assertAliasInput, normalizeExternalKey } from './variantAliasValidation.js';

const safeCandidate = (row) => {
  const data = row.normalizedData ?? {};
  return {
    candidateId: row.id, sheetRowNumber: row.sheetRowNumber, sheetName: row.sheetName ?? data.sheetName ?? null,
    medium: row.sourceMedium ?? data.medium ?? null, sheetSku: row.sourceSku ?? data.sku ?? null,
    normalizedSheetSku: normalizeExternalKey(row.sourceSku ?? data.sku), wmproductId: data.wmproductId ?? null,
    price: data.price ?? null, durationDays: data.durationDays ?? null, dataType: data.dataType ?? null,
    apn: data.apn ?? null, networkLabel: data.networkLabel ?? null, status: row.status,
    errors: row.errors ?? [], warnings: row.warnings ?? [], variantId: row.variantId ?? null,
  };
};

const providerCandidates = ({ candidate, variants, offers }) => {
  if (!candidate.wmproductId || !candidate.medium) return { items: [], evidence: [], conflicts: [], unmatchedReason: 'NO_PROVIDER_ID' };
  const offersById = offers.filter((offer) => offer.wmproductId === candidate.wmproductId);
  const providerLinked = variants.filter((variant) => variant.medium === candidate.medium && offersById.some((offer) => variant.providerOfferId === offer.id || variant.wmproductId === offer.wmproductId));
  // This is an admin-only proposal when the QA catalog has no provider-offer snapshot.
  // Runtime resolution never calls this path and never uses WMID as a variant key.
  const canonicalWmidSuggestions = variants.filter((variant) => variant.medium === candidate.medium && variant.wmproductId === candidate.wmproductId);
  const items = offersById.length ? providerLinked : canonicalWmidSuggestions;
  const conflicts = [];
  if (offersById.length > 1) conflicts.push({ code: 'RECONCILIATION_CONFLICT', reason: 'WMID_MATCHES_MULTIPLE_PROVIDER_OFFERS' });
  const expectedProviderType = candidate.medium === 'physical_sim' ? 1 : 0;
  if (offersById.some((offer) => offer.providerProductType !== expectedProviderType)) conflicts.push({ code: 'RECONCILIATION_CONFLICT', reason: 'PROVIDER_MEDIUM_MISMATCH' });
  if (items.length > 1) conflicts.push({ code: 'RECONCILIATION_CONFLICT', reason: 'WMID_MATCHES_MULTIPLE_VARIANTS' });
  if (items.some((variant) => variant.currency !== 'VND')) conflicts.push({ code: 'RECONCILIATION_CONFLICT', reason: 'CURRENCY_MISMATCH' });
  return { items, evidence: items.map((variant) => ({ type: offersById.length ? 'WMID_MEDIUM_PROVIDER_OFFER' : 'WMID_MEDIUM_CANONICAL_FIELD', variantId: variant.id, providerOfferId: variant.providerOfferId ?? null })), conflicts, unmatchedReason: items.length === 0 ? 'NO_PROVIDER_CANDIDATE' : items.length > 1 ? 'AMBIGUOUS_PROVIDER_CANDIDATE' : null };
};

const buildSuggestionReport = ({ row, catalog, offers }) => {
  const candidate = safeCandidate(row);
  const direct = catalog.variants.filter((variant) => normalizeExternalKey(variant.sku) === candidate.normalizedSheetSku && variant.medium === candidate.medium);
  const provider = providerCandidates({ candidate, variants: catalog.variants, offers });
  const items = [...new Map([...direct, ...provider.items].map((variant) => [variant.id, variant])).values()].map((variant) => ({
    product: catalog.products.find((product) => product.id === variant.productId) ?? null,
    variant: { id: variant.id, sku: variant.sku, medium: variant.medium, price: variant.price, currency: variant.currency, durationDays: variant.durationDays ?? null, providerOfferId: variant.providerOfferId ?? null, wmproductId: variant.wmproductId ?? null, archived: variant.archived === true },
    evidence: direct.some((item) => item.id === variant.id) ? [{ type: 'CANONICAL_SKU_MEDIUM', strength: 'DIRECT' }] : provider.evidence.filter((item) => item.variantId === variant.id),
    warnings: [...provider.conflicts, ...((catalog.products.find((product) => product.id === variant.productId)?.status === 'archived' || variant.archived === true) ? [{ code: 'EXTERNAL_ALIAS_TARGET_ARCHIVED', reason: 'TARGET_ARCHIVED' }] : [])],
  }));
  return { canonicalCandidates: items, providerOfferCandidates: provider.items.map((variant) => ({ variantId: variant.id, providerOfferId: variant.providerOfferId ?? null, wmproductId: variant.wmproductId ?? null })), evidence: items.flatMap((item) => item.evidence), conflicts: provider.conflicts, unmatchedReason: items.length ? null : provider.unmatchedReason ?? 'NO_CANONICAL_CANDIDATE' };
};

export const createVariantAliasService = ({ aliasRepository, sheetSyncRepository, canonicalRepository, providerRepository, audit = () => {}, now = () => new Date().toISOString() }) => ({
  async listUnmatched({ limit = 100 } = {}) {
    const batches = await sheetSyncRepository.listBatches({ limit });
    const [catalog, offers] = await Promise.all([canonicalRepository.readCatalog({ required: true }), providerRepository.listOffers()]);
    const result = [];
    for (const batch of batches) {
      const rows = await sheetSyncRepository.listRows(batch.id);
      for (const row of rows) if (!row.variantId || row.status === 'INVALID') result.push({ ...safeCandidate({ ...row, sheetName: batch.sheetTab }), batchId: batch.id, sheetTab: batch.sheetTab, sheetRange: batch.sheetRange, ...buildSuggestionReport({ row: { ...row, sheetName: batch.sheetTab }, catalog, offers }) });
    }
    return result.slice(0, limit);
  },
  async candidates(candidateId) {
    const row = await sheetSyncRepository.getRow(candidateId);
    if (!row) throw new SheetSyncError('Reconciliation candidate was not found.', { code: 'RECONCILIATION_CANDIDATE_NOT_FOUND', status: 404 });
    const catalog = await canonicalRepository.readCatalog({ required: true });
    const offers = await providerRepository.listOffers();
    return { candidate: safeCandidate(row), ...buildSuggestionReport({ row, catalog, offers }) };
  },
  async create(input, actor = {}) {
    const value = assertAliasInput(input);
    const catalog = await canonicalRepository.readCatalog({ required: true });
    const variant = catalog.variants.find((item) => item.id === value.variantId);
    const product = catalog.products.find((item) => item.id === variant?.productId);
    if (!variant || !product) throw new SheetSyncError('Alias target does not exist in the active canonical catalog.', { code: 'EXTERNAL_ALIAS_TARGET_NOT_FOUND', status: 422 });
    if (product.status === 'archived' || variant.archived === true) throw new SheetSyncError('Alias target is archived.', { code: 'EXTERNAL_ALIAS_TARGET_ARCHIVED', status: 422 });
    if (variant.medium !== value.medium) throw new SheetSyncError('Alias target medium does not match.', { code: 'EXTERNAL_ALIAS_MEDIUM_MISMATCH', status: 422 });
    const alias = await aliasRepository.create(value, actor); audit({ event: 'catalog_variant_external_alias_created', actorId: actor.id, aliasId: alias.id, variantId: alias.variantId, at: now() }); return alias;
  },
  async update(id, input, actor = {}) { const alias = await aliasRepository.update(id, input, actor, input.version); audit({ event: 'catalog_variant_external_alias_remapped', actorId: actor.id, aliasId: id, variantId: alias.variantId, at: now() }); return alias; },
  async revoke(id, input = {}, actor = {}) { const alias = await aliasRepository.revoke(id, actor, input.version); audit({ event: 'catalog_variant_external_alias_revoked', actorId: actor.id, aliasId: id, at: now() }); return alias; },
  resolve({ row, products, variants, aliases }) { return resolveSheetVariantIdentity({ row, products, variants, aliases }); },
  namespaceForMedium,
});
