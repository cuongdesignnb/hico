import { createHash, randomUUID } from 'node:crypto';
import { readJson } from '../write/catalogWritePersistence.js';
import { defaultUploadsDirectory } from '../write/catalogWritePersistence.js';
import { assertCanonicalCatalog } from '../canonical/canonicalCatalogValidation.js';
import { applySkuConflictMetadata } from '../canonical/canonicalSkuConflicts.js';
import { cloneSeedCategories } from '../categories/catalogCategories.js';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import { createCatalogAuditRepository } from '../write/catalogAuditRepository.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createSheetReferenceClient } from './sheetReferenceClient.js';
import { collapseHicoGocRows, parseHicoGocRows } from './hicoGocParser.js';
import { hicoGocHeaderHash, HICO_GOC_SHEET, normalizeHicoGocSettings } from './hicoGocMapping.js';
import { createSheetSyncRepository, publicBatch, publicRow } from './sheetSyncRepository.js';
import { SheetSyncError } from './sheetSyncTypes.js';
import { createCatalogCommandService } from '../write/catalogCommandService.js';
import { sanitizeCatalogHtml } from '../write/catalogProductValidation.js';

const PLACEHOLDER_IMAGES = Object.freeze({
  esim: '/images/art_esim_intro.png',
  physical_sim: '/images/art_sim_compare.png',
  device: '/images/device_wifi_mini.png',
  other: '/images/art_esim_intro.png',
});
const FALLBACK_INSTALLATION_GUIDE = 'Hướng dẫn cài đặt đang được cập nhật.';
const normalizeToken = (value) => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const sha = (value) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex').slice(0, 24);
const currentVersion = (manifest) => manifest?.versionId ?? manifest?.migrationId ?? null;
const productSourceParts = (data) => [
  normalizeToken(data?.productName),
  normalizeToken(data?.dataPolicy),
  normalizeToken(data?.dataLimit),
  normalizeToken(data?.networkLabel),
  normalizeToken(data?.medium ?? data?.sourceMedium),
];

export const productSourceKeyFor = (data) => `hico-goc:${sha(productSourceParts(data))}`;
export const variantSourceKeyFor = (data) => `hico-goc-variant:${sha([
  normalizeToken(data?.sku),
  normalizeToken(data?.medium),
  normalizeToken(data?.wmproductId),
])}`;

const slugFor = (name, sourceKey) => {
  const base = normalizeToken(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'san-pham';
  return `${base}-${sourceKey.slice(-8)}`;
};

const operationFor = (rows, previousProduct) => {
  if (previousProduct?.operation) return previousProduct.operation;
  return rows.some((row) => row.providerOffer?.providerProductType === 2) ? 'topup' : 'new_subscription';
};

const fulfillmentFor = (offer, medium) => {
  if (!offer) return {
    supplier: 'other',
    fulfillmentMethod: 'MANUAL_PROCESSING',
    providerProductType: null,
    leSIM: null,
    requiresExistingSim: false,
  };
  if (offer.providerProductType === 2) return {
    supplier: 'worldmove',
    fulfillmentMethod: 'WORLDMOVE_TOPUP',
    providerProductType: 2,
    leSIM: offer.leSIM ?? null,
    requiresExistingSim: true,
  };
  if (offer.providerProductType === 1) return {
    supplier: 'worldmove',
    fulfillmentMethod: 'WORLDMOVE_PHYSICAL_ORDER',
    providerProductType: 1,
    leSIM: false,
    requiresExistingSim: false,
  };
  return {
    supplier: 'worldmove',
    fulfillmentMethod: medium === 'esim' && offer.leSIM === false
      ? 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM'
      : 'WORLDMOVE_ESIM_REDEEM',
    providerProductType: 0,
    leSIM: offer.leSIM ?? true,
    requiresExistingSim: false,
  };
};

const hasValue = (value) => nonEmpty(value) || (Array.isArray(value) && value.length > 0);
const uniqueValue = (rows, field) => {
  const source = rows.map((row) => row.normalizedData?.[field]).filter(hasValue);
  const values = [...new Map(source.map((value) => [JSON.stringify(value), value])).values()];
  return values.length === 1 ? values[0] : values.length === 0 ? undefined : { conflict: values };
};

const mediaFields = (product) => ({
  ...(product?.image ? { image: product.image } : {}),
  ...(product?.primaryMediaId ? { primaryMediaId: product.primaryMediaId } : {}),
  ...(Array.isArray(product?.galleryMediaIds) ? { galleryMediaIds: [...product.galleryMediaIds] } : {}),
  ...(Array.isArray(product?.gallery) ? { gallery: [...product.gallery] } : {}),
  ...(Array.isArray(product?.images) ? { images: [...product.images] } : {}),
});

export const createEnrichmentIndex = ({ products = [], variants = [] } = {}) => {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const byProductSourceKey = new Map();
  const byVariantSourceKey = new Map();
  for (const product of products) {
    if (nonEmpty(product.sourceKey)) byProductSourceKey.set(product.sourceKey, product);
  }
  for (const variant of variants) {
    const product = productsById.get(variant.productId);
    if (!product) continue;
    const key = nonEmpty(variant.sourceKey)
      ? variant.sourceKey
      : variantSourceKeyFor({ sku: variant.sku, medium: variant.medium, wmproductId: variant.wmproductId });
    const existing = byVariantSourceKey.get(key);
    if (!existing || existing.id === product.id) byVariantSourceKey.set(key, product);
    else byVariantSourceKey.set(key, null);
  }
  return { byProductSourceKey, byVariantSourceKey };
};

const enrichmentForRows = (rows, index) => {
  const productKey = productSourceKeyFor(rows[0]?.normalizedData ?? {});
  const direct = index.byProductSourceKey.get(productKey);
  if (direct) return direct;
  const matches = new Map();
  for (const row of rows) {
    const product = index.byVariantSourceKey.get(variantSourceKeyFor(row.normalizedData));
    if (product) matches.set(product.id, product);
  }
  return matches.size === 1 ? [...matches.values()][0] : null;
};

const resolveImage = async ({ pathValue, mediaAssetRepository }) => {
  if (!/^\/(?:images|uploads)\//.test(String(pathValue ?? '')) || String(pathValue).includes('..')) return { path: undefined, mediaId: undefined };
  const asset = await mediaAssetRepository?.getById?.(pathValue);
  return { path: pathValue, mediaId: asset?.id };
};

const validProviderRows = ({ rows, offers }) => {
  const offersByWmid = new Map();
  for (const offer of offers) {
    const matches = offersByWmid.get(offer.wmproductId) ?? [];
    matches.push(offer);
    offersByWmid.set(offer.wmproductId, matches);
  }
  return rows.map((row) => {
    const errors = [...(row.errors ?? [])];
    const matches = offersByWmid.get(row.normalizedData?.wmproductId) ?? [];
    if (!row.normalizedData?.wmproductId || matches.length === 0) errors.push({ code: 'PROVIDER_NOT_FOUND', field: 'wmproductId' });
    if (matches.length > 1) errors.push({ code: 'PROVIDER_AMBIGUOUS', field: 'wmproductId' });
    if (matches.length === 1 && matches[0].active === false) errors.push({ code: 'PROVIDER_INACTIVE', field: 'wmproductId' });
    return {
      ...row,
      errors,
      status: errors.length ? 'INVALID' : 'VALID',
      providerOffer: matches.length === 1 && matches[0].active !== false ? matches[0] : null,
      normalizedData: {
        ...row.normalizedData,
        sourceKey: productSourceKeyFor(row.normalizedData),
        variantSourceKey: variantSourceKeyFor(row.normalizedData),
      },
    };
  });
};

export const buildFullSyncCandidate = async ({
  rows = [],
  categories = cloneSeedCategories(),
  offers = [],
  previousCatalog = null,
  now = () => new Date(),
  mediaAssetRepository = null,
} = {}) => {
  const preparedRows = validProviderRows({ rows, offers });
  const validRows = preparedRows.filter((row) => row.status === 'VALID');
  const index = createEnrichmentIndex(previousCatalog ?? {});
  const groups = new Map();
  for (const row of validRows) {
    const key = row.normalizedData.sourceKey;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const products = [];
  const variants = [];
  const enrichment = {
    imagesReused: 0, imagesFromSheet: 0, imagesFallback: 0,
    descriptionsReused: 0, descriptionsFromSheet: 0, descriptionsFallback: 0,
    installationGuideReused: 0, installationGuideFromSheet: 0, installationGuideFallback: 0,
  };
  for (const groupRows of groups.values()) {
    const first = groupRows[0];
    const data = first.normalizedData;
    const previousProduct = enrichmentForRows(groupRows, index);
    const description = uniqueValue(groupRows, 'description');
    const installationGuide = uniqueValue(groupRows, 'installationGuide');
    const imageValue = uniqueValue(groupRows, 'imageUrl');
    const galleryValue = uniqueValue(groupRows, 'galleryImageUrls');
    if (description?.conflict) groupRows.forEach((row) => { row.errors.push({ code: 'DESCRIPTION_CONFLICT', field: 'description' }); row.status = 'INVALID'; });
    if (installationGuide?.conflict) groupRows.forEach((row) => { row.errors.push({ code: 'INSTALLATION_GUIDE_CONFLICT', field: 'installationGuide' }); row.status = 'INVALID'; });
    if (imageValue?.conflict) groupRows.forEach((row) => { row.errors.push({ code: 'IMAGE_CONFLICT', field: 'imageUrl' }); row.status = 'INVALID'; });
    if (galleryValue?.conflict) groupRows.forEach((row) => { row.errors.push({ code: 'GALLERY_IMAGE_CONFLICT', field: 'galleryImageUrls' }); row.status = 'INVALID'; });
    if (groupRows.some((row) => row.status !== 'VALID')) continue;
    const productSourceKey = data.sourceKey;
    const productId = previousProduct?.id ?? `product-${sha(productSourceKey)}`;
    const sheetGallery = Array.isArray(galleryValue) ? galleryValue : [];
    const sheetImage = await resolveImage({ pathValue: imageValue ?? sheetGallery[0], mediaAssetRepository });
    const sheetGalleryPaths = sheetImage.path && sheetGallery.includes(sheetImage.path) ? sheetGallery.filter((value) => value !== sheetImage.path) : sheetGallery;
    const sheetGalleryAssets = await Promise.all(sheetGalleryPaths.map((pathValue) => resolveImage({ pathValue, mediaAssetRepository })));
    const previousMedia = mediaFields(previousProduct);
    const hasPreviousMedia = Object.keys(previousMedia).length > 0;
    const image = hasPreviousMedia
      ? previousMedia
      : sheetImage.path
        ? {
          image: sheetImage.path,
          ...(sheetImage.mediaId ? { primaryMediaId: sheetImage.mediaId } : {}),
          ...(sheetGalleryAssets.length ? { gallery: sheetGalleryAssets.map((asset, index) => ({ id: asset.mediaId ?? `sheet-gallery-${index + 1}`, url: asset.path, alt: data.productName, sortOrder: index })) } : {}),
        }
        : { image: PLACEHOLDER_IMAGES[first.sourceMedium] ?? PLACEHOLDER_IMAGES.other };
    if (hasPreviousMedia) enrichment.imagesReused += 1;
    else if (sheetImage.path) enrichment.imagesFromSheet += 1;
    else enrichment.imagesFallback += 1;
    const productDescription = nonEmpty(description)
      ? sanitizeCatalogHtml(description)
      : nonEmpty(previousProduct?.description)
        ? previousProduct.description
        : first.sourceMedium === 'esim'
          ? `Gói eSIM ${data.productName} dành cho nhu cầu kết nối khi đi du lịch. Vui lòng chọn gói dữ liệu và thời hạn phù hợp bên dưới.`
          : `SIM vật lý ${data.productName}. Thông tin gói cước và thời hạn sử dụng được hiển thị theo từng lựa chọn bên dưới.`;
    if (nonEmpty(description)) enrichment.descriptionsFromSheet += 1;
    else if (nonEmpty(previousProduct?.description)) enrichment.descriptionsReused += 1;
    else enrichment.descriptionsFallback += 1;
    const productInstallationGuide = nonEmpty(installationGuide)
      ? sanitizeCatalogHtml(installationGuide)
      : nonEmpty(previousProduct?.installationGuide)
        ? previousProduct.installationGuide
        : FALLBACK_INSTALLATION_GUIDE;
    if (nonEmpty(installationGuide)) enrichment.installationGuideFromSheet += 1;
    else if (nonEmpty(previousProduct?.installationGuide)) enrichment.installationGuideReused += 1;
    else enrichment.installationGuideFallback += 1;
    const timestamp = now().toISOString();
    products.push({
      ...(previousProduct?.categoryId ? { categoryId: previousProduct.categoryId } : { categoryId: null, categoryNeedsReview: true }),
      ...(previousProduct?.coverageType ? { coverageType: previousProduct.coverageType, coverageIds: [...(previousProduct.coverageIds ?? [])] } : { coverageType: 'not_applicable', coverageIds: [] }),
      ...image,
      ...(previousProduct?.featured !== undefined ? { featured: previousProduct.featured } : { featured: false }),
      ...(previousProduct?.seoTitle ? { seoTitle: previousProduct.seoTitle } : {}),
      ...(previousProduct?.seoDescription ? { seoDescription: previousProduct.seoDescription } : {}),
      ...(previousProduct?.seoKeywords ? { seoKeywords: previousProduct.seoKeywords } : {}),
      id: productId,
      sourceKey: productSourceKey,
      slug: previousProduct?.slug ?? slugFor(data.productName, productSourceKey),
      name: data.productName,
      operation: operationFor(groupRows, previousProduct),
      description: productDescription,
      installationGuide: productInstallationGuide,
      status: 'draft',
      version: 1,
      createdAt: previousProduct?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    for (const row of groupRows) {
      const variantData = row.normalizedData;
      const previousVariant = (previousCatalog?.variants ?? []).find((candidate) => (
        candidate.sourceKey === variantData.variantSourceKey
        || variantSourceKeyFor(candidate) === variantData.variantSourceKey
      ));
      const fulfillment = fulfillmentFor(row.providerOffer, row.sourceMedium);
      variants.push({
        ...(previousVariant?.publicSku ? { publicSku: previousVariant.publicSku } : {}),
        id: previousVariant?.id ?? `variant-${sha(variantData.variantSourceKey)}`,
        sourceKey: variantData.variantSourceKey,
        productId,
        sku: variantData.sku,
        dataLimit: variantData.dataLimit,
        duration: variantData.duration,
        ...(variantData.tripDayOptions ? { tripDayOptions: variantData.tripDayOptions } : {}),
        price: variantData.price ?? 0,
        compareAtPrice: variantData.compareAtPrice ?? null,
        currency: 'VND',
        medium: variantData.medium,
        ...fulfillment,
        ...(row.providerOffer ? { providerOfferId: row.providerOffer.id, wmproductId: row.providerOffer.wmproductId } : {}),
        ...(row.providerOffer?.providerProductId ? { providerProductId: row.providerOffer.providerProductId } : {}),
        ...(variantData.activationPolicy ? { activationPolicy: variantData.activationPolicy } : {}),
        ...(variantData.networkLabel ? { networkLabel: variantData.networkLabel } : {}),
        ...(variantData.publicNote ? { publicNote: variantData.publicNote } : {}),
        ...(variantData.speedLabel ? { speedLabel: variantData.speedLabel } : {}),
        ...(typeof variantData.cancellable === 'boolean' ? { cancellable: variantData.cancellable } : {}),
        shippingRequired: row.sourceMedium === 'physical_sim',
        stock: previousVariant?.stock ?? null,
        active: false,
        needsReview: true,
        version: 1,
        createdAt: previousVariant?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
    }
  }
  const safeVariants = applySkuConflictMetadata(variants);
  assertCanonicalCatalog({ products, variants: safeVariants, categories, providerOffers: offers, manualQrs: [] });
  return {
    products,
    variants: safeVariants,
    rows: preparedRows,
    summary: {
      products: products.length,
      variants: safeVariants.length,
      invalidRows: preparedRows.filter((row) => row.status === 'INVALID').length,
      ...enrichment,
    },
  };
};

const sourceHashFor = (reference, settings, offers) => createHash('sha256').update(JSON.stringify({
  spreadsheetId: reference.spreadsheetId,
  sheetTab: reference.sheetTab,
  sheetRange: reference.sheetRange,
  values: reference.values,
  settings,
  providerSnapshot: offers.map((offer) => ({ id: offer.id, wmproductId: offer.wmproductId, active: offer.active, version: offer.version })).sort((a, b) => `${a.id}`.localeCompare(`${b.id}`)),
}), 'utf8').digest('hex');

const providerSnapshotHashFor = (offers) => createHash('sha256').update(JSON.stringify(offers.map((offer) => ({ id: offer.id, wmproductId: offer.wmproductId, active: offer.active, version: offer.version })).sort((a, b) => `${a.id}`.localeCompare(`${b.id}`))), 'utf8').digest('hex');

const readManualQrs = (uploadsDirectory) => readJson(`${uploadsDirectory}/manual_qrs.json`, []);

export const createCatalogResyncService = ({
  repository = createSheetSyncRepository(),
  referenceClient = createSheetReferenceClient(),
  canonicalRepository = createCanonicalCatalogRepository(),
  commitService = createCatalogVersionCommitService(),
  auditRepository = createCatalogAuditRepository(),
  providerRepository = createProviderOfferRepository(),
  commandService = createCatalogCommandService(),
  mediaAssetRepository = null,
  uploadsDirectory = defaultUploadsDirectory,
  now = () => new Date(),
  idFactory = () => randomUUID(),
  logger = console,
} = {}) => {
  const loadPreviousCatalog = async ({ current, requestedVersionId }) => {
    if (requestedVersionId) return commitService.readVersion(requestedVersionId);
    if (current.products.length > 0) return current;
    const versions = await commitService.listVersions();
    for (const version of versions) {
      if (version.versionId === currentVersion(current.manifest)) continue;
      try {
        const candidate = await commitService.readVersion(version.versionId);
        if (candidate.products.length > 0) return candidate;
      } catch {
        // A malformed historical version is not a safe enrichment source.
      }
    }
    return { products: [], variants: [], categories: current.categories ?? cloneSeedCategories(), manifest: null };
  };
  const validateReference = (reference, settings) => {
    if (reference.sheetTab !== HICO_GOC_SHEET) throw new SheetSyncError(`Full sync yêu cầu tab ${HICO_GOC_SHEET}.`, { code: 'SHEET_SOURCE_TAB_INVALID', status: 422 });
    const headerHash = hicoGocHeaderHash(reference.values[0] ?? []);
    if (settings.headerHash && settings.headerHash !== headerHash) throw new SheetSyncError('HICO GỐC header đã thay đổi sau khi lưu mapping.', { code: 'SHEET_HEADER_CHANGED', status: 409 });
    return headerHash;
  };
  const build = async ({ reference, settings, current, previousCatalog, offers }) => {
    const parsed = collapseHicoGocRows(parseHicoGocRows(reference.values, settings));
    return buildFullSyncCandidate({ rows: parsed, categories: current.categories, offers, previousCatalog, now, mediaAssetRepository });
  };
  return {
    async fullPreview({ actor = {} } = {}) {
      const reference = await referenceClient.readRows();
      const settings = normalizeHicoGocSettings(reference.syncSettings ?? {});
      validateReference(reference, settings);
      const [current, offers] = await Promise.all([
        canonicalRepository.readCatalog({ required: true }),
        providerRepository.listOffers(),
      ]);
      const previousCatalog = await loadPreviousCatalog({ current });
      const sourceHash = sourceHashFor(reference, settings, offers);
      const existing = await repository.findBySourceHash(sourceHash);
      if (existing) return { batch: publicBatch(existing), rows: (await repository.listRows(existing.id)).map(publicRow), idempotent: true };
      const candidate = await build({ reference, settings, current, previousCatalog, offers });
      const summary = {
        total: candidate.rows.length,
        valid: candidate.rows.filter((row) => row.status === 'VALID').length,
        invalid: candidate.rows.filter((row) => row.status === 'INVALID').length,
        changedFields: 0,
        enrichmentSourceVersionId: currentVersion(previousCatalog.manifest),
        ...candidate.summary,
      };
      const batch = {
        id: idFactory(), mode: 'full', sourceHash, providerSnapshotHash: providerSnapshotHashFor(offers),
        spreadsheetId: reference.spreadsheetId, sheetTab: reference.sheetTab, sheetRange: reference.sheetRange,
        status: 'READY_FOR_REVIEW', createdBy: actor.id ?? null, createdAt: now().toISOString(), validatedAt: now().toISOString(),
        catalogVersionId: currentVersion(current.manifest), fieldMapping: settings.fieldMapping, priceMapping: settings.priceMapping,
        headerHash: settings.headerHash, summary,
      };
      const rows = candidate.rows.map((row) => ({ ...row, id: idFactory(), variantId: null, raw: undefined, diff: {}, appliedFields: [], createdAt: now().toISOString() }));
      await repository.createBatch(batch, rows);
      logger.info?.('[catalog-full-sync] preview', { batchId: batch.id, products: summary.products, variants: summary.variants, invalidRows: summary.invalid });
      return { batch: publicBatch(batch), rows: rows.map(publicRow), idempotent: false };
    },

    async fullApply(id, { actor = {} } = {}) {
      const batch = await repository.getBatch(id);
      if (!batch || batch.mode !== 'full') throw new SheetSyncError('Full sync batch was not found.', { code: 'SHEET_BATCH_NOT_FOUND', status: 404 });
      if (['APPLIED', 'PARTIALLY_APPLIED'].includes(batch.status)) return { batch: publicBatch(batch), rows: (await repository.listRows(id)).map(publicRow), versionId: batch.catalogVersionId, idempotent: true };
      const reference = await referenceClient.readRows();
      const settings = normalizeHicoGocSettings({ fieldMapping: batch.fieldMapping, priceMapping: batch.priceMapping, headerHash: batch.headerHash });
      validateReference(reference, settings);
      const [current, offers] = await Promise.all([canonicalRepository.readCatalog({ required: true }), providerRepository.listOffers()]);
      if (currentVersion(current.manifest) !== batch.catalogVersionId) throw new SheetSyncError('Catalog đã thay đổi sau preview. Hãy tạo lại preview.', { code: 'SHEET_SYNC_CONCURRENCY_CONFLICT', status: 409 });
      if (sourceHashFor(reference, settings, offers) !== batch.sourceHash) throw new SheetSyncError('Sheet, mapping hoặc provider snapshot đã thay đổi sau preview.', { code: 'SHEET_SYNC_STALE_PREVIEW', status: 409 });
      if (batch.providerSnapshotHash && providerSnapshotHashFor(offers) !== batch.providerSnapshotHash) throw new SheetSyncError('Provider snapshot đã thay đổi sau preview.', { code: 'PROVIDER_SNAPSHOT_CHANGED', status: 409 });
      const rows = await repository.listRows(id);
      if (rows.some((row) => row.status === 'INVALID')) throw new SheetSyncError('Full sync đang có dòng lỗi; chưa ghi catalog.', { code: 'FULL_SYNC_INVALID_ROWS', status: 422, details: { invalidRows: rows.filter((row) => row.status === 'INVALID').length } });
      const claimed = await repository.claimForApply(id, actor.id);
      if (!claimed) throw new SheetSyncError('Full sync đang được xử lý hoặc không còn ở trạng thái review.', { code: 'SHEET_SYNC_APPLY_IN_PROGRESS', status: 409 });
      const previousCatalog = await loadPreviousCatalog({ current, requestedVersionId: batch.summary?.enrichmentSourceVersionId });
      const candidate = await build({ reference: { ...reference }, settings, current, previousCatalog, offers });
      const manualQrs = await readManualQrs(uploadsDirectory);
      const newVersionId = `catalog-full-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const createdAt = now().toISOString();
      const audit = {
        id: `audit-${randomUUID()}`, actorId: actor.id, actorEmail: actor.email, action: 'CATALOG_FULL_SYNC', entityType: 'catalog', entityId: batch.id,
        sourceSheet: HICO_GOC_SHEET, previousVersionId: currentVersion(current.manifest), enrichmentSourceVersionId: currentVersion(previousCatalog.manifest),
        newVersionId, products: candidate.summary.products, variants: candidate.summary.variants,
        imagesReused: candidate.summary.imagesReused, imagesFromSheet: candidate.summary.imagesFromSheet, imagesFallback: candidate.summary.imagesFallback,
        descriptionsReused: candidate.summary.descriptionsReused, descriptionsFromSheet: candidate.summary.descriptionsFromSheet, descriptionsFallback: candidate.summary.descriptionsFallback,
        installationGuideReused: candidate.summary.installationGuideReused, installationGuideFromSheet: candidate.summary.installationGuideFromSheet, installationGuideFallback: candidate.summary.installationGuideFallback,
        createdAt,
      };
      try {
        const committed = await commitService.commit({
          versionId: newVersionId, parentVersionId: currentVersion(current.manifest), products: candidate.products, variants: candidate.variants,
          categories: current.categories, providerOffers: offers, manualQrs, commandType: 'CATALOG_FULL_SYNC', commandId: id,
          requestHash: batch.sourceHash, createdAt,
          beforePointer: () => auditRepository.append(audit),
          rollbackBeforePointer: () => auditRepository.remove(audit.id),
        });
        const appliedAt = now().toISOString();
        await repository.updateRows(id, Object.fromEntries(rows.map((row) => [row.id, { status: 'APPLIED', appliedFields: ['fullCatalog'], appliedAt }])));
        const nextBatch = await repository.updateBatch(id, { status: 'APPLIED', summary: { ...batch.summary, ...candidate.summary }, appliedAt, catalogVersionId: committed.manifest.versionId });
        return { batch: publicBatch(nextBatch), rows: (await repository.listRows(id)).map(publicRow), versionId: committed.manifest.versionId, idempotent: false };
      } catch (error) {
        await repository.updateBatch(id, { status: 'READY_FOR_REVIEW', summary: batch.summary });
        throw error;
      }
    },
  };
};

export { PLACEHOLDER_IMAGES, FALLBACK_INSTALLATION_GUIDE };
