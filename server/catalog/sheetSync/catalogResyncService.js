import { createHash, randomUUID } from 'node:crypto';
import { readJson } from '../write/catalogWritePersistence.js';
import { defaultUploadsDirectory } from '../write/catalogWritePersistence.js';
import { assertCanonicalCatalog } from '../canonical/canonicalCatalogValidation.js';
import { applySkuConflictMetadata } from '../canonical/canonicalSkuConflicts.js';
import { categoryIdForPackage, cloneSeedCategories, mergeCatalogCategories } from '../categories/catalogCategories.js';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import { createCatalogAuditRepository } from '../write/catalogAuditRepository.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createSheetReferenceClient } from './sheetReferenceClient.js';
import { collapseHicoGocRows, parseHicoGocRowsWithDiagnostics } from './hicoGocParser.js';
import { hicoGocHeaderHash, HICO_GOC_SHEET, normalizeHicoGocSettings, validateHicoGocRange } from './hicoGocMapping.js';
import { createSheetSyncRepository, publicBatch, publicRow } from './sheetSyncRepository.js';
import { SheetSyncError } from './sheetSyncTypes.js';
import { createCatalogCommandService } from '../write/catalogCommandService.js';
import { sanitizeCatalogHtml } from '../write/catalogProductValidation.js';
import { assertFullSyncCandidate, assertPersistedFullSyncSummary, fullSyncDiagnostics, rejectionReasonsForRows } from './catalogResyncDiagnostics.js';
import {
  legacyProductSourceKeyFor,
  legacyVariantSourceKeyFor,
  normalizeIdentityToken,
  packageFamilyKeyFor,
  productSourceKeyFor,
  variantSourceKeyFor,
} from './packageFamilyIdentity.js';
import { classifyHicoGocSourceRows, classifyHicoPackageClass, operationEvidenceFor } from './hicoGocSourceClassifier.js';

const PLACEHOLDER_IMAGES = Object.freeze({
  esim: '/images/art_esim_intro.png',
  physical_sim: '/images/art_sim_compare.png',
  device: '/images/device_wifi_mini.png',
  other: '/images/art_esim_intro.png',
});
const FALLBACK_INSTALLATION_GUIDE = 'Hướng dẫn cài đặt đang được cập nhật.';
const normalizeToken = normalizeIdentityToken;
const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const sha = (value) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex').slice(0, 24);
const currentVersion = (manifest) => manifest?.versionId ?? manifest?.migrationId ?? null;
export { productSourceKeyFor, variantSourceKeyFor } from './packageFamilyIdentity.js';

const PROVIDER_RESOLUTIONS = Object.freeze({
  RESOLVED: 'RESOLVED',
  UNRESOLVED: 'UNRESOLVED',
  AMBIGUOUS: 'AMBIGUOUS',
  INACTIVE: 'INACTIVE',
});
const PROVIDER_WARNING_CODES = new Set(['PROVIDER_NOT_FOUND', 'PROVIDER_AMBIGUOUS', 'PROVIDER_INACTIVE']);

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

const fulfillmentFor = (offer, medium, operation) => {
  if (!offer) return {
    supplier: 'other',
    fulfillmentMethod: 'MANUAL_PROCESSING',
    providerProductType: null,
    leSIM: null,
    requiresExistingSim: operation === 'topup',
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
    requiresExistingSim: operation === 'topup',
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
  const productsById = new Map();
  const byProductSourceKey = new Map();
  const byVariantSourceKey = new Map();
  const byVariantRecordSourceKey = new Map();
  const setUnique = (map, key, value) => {
    if (!nonEmpty(key)) return;
    const existing = map.get(key);
    if (!map.has(key) || existing === value) map.set(key, value);
    else map.set(key, null);
  };
  for (const product of products) {
    setUnique(productsById, product.id, product);
    setUnique(byProductSourceKey, product.sourceKey, product);
    setUnique(byProductSourceKey, productSourceKeyFor({
      productName: product.name,
      operation: product.operation,
      medium: product.medium,
      sourceCategoryLabel: product.sourceCategoryLabel,
      coverageLabel: product.coverageLabel,
    }), product);
  }
  for (const variant of variants) {
    const product = productsById.get(variant.productId);
    if (!product) continue;
    const key = nonEmpty(variant.sourceKey)
      ? variant.sourceKey
      : variantSourceKeyFor({ sku: variant.sku, medium: variant.medium, wmproductId: variant.wmproductId });
    setUnique(byVariantSourceKey, key, product);
    setUnique(byVariantRecordSourceKey, key, variant);
    const legacyKey = legacyVariantSourceKeyFor({ sku: variant.sku, medium: variant.medium, wmproductId: variant.wmproductId });
    setUnique(byVariantSourceKey, legacyKey, product);
    setUnique(byVariantRecordSourceKey, legacyKey, variant);
    const legacyProductKey = legacyProductSourceKeyFor({
      productName: product.name,
      dataPolicy: variant.dataPolicy,
      dataLimit: variant.dataLimit,
      networkLabel: variant.networkLabel ?? product.networkLabel,
      medium: variant.medium,
    });
    setUnique(byProductSourceKey, legacyProductKey, product);
  }
  return { byProductSourceKey, byVariantSourceKey, byVariantRecordSourceKey };
};

const createEnrichmentReuseState = () => ({
  claimedProductIds: new Set(),
  claimedVariantIds: new Set(),
  usedSlugs: new Set(),
});

const availableProduct = (product, reuseState) => (
  product && (!reuseState || !reuseState.claimedProductIds.has(product.id)) ? product : null
);

const claimProduct = (product, reuseState) => {
  if (!availableProduct(product, reuseState)) return null;
  reuseState?.claimedProductIds.add(product.id);
  return product;
};

const enrichmentForRows = (rows, index, reuseState) => {
  const productKey = productSourceKeyFor(rows[0]?.normalizedData ?? {});
  const directCandidates = [
    index.byProductSourceKey.get(productKey),
    index.byProductSourceKey.get(legacyProductSourceKeyFor(rows[0]?.normalizedData ?? {})),
  ];
  const direct = directCandidates.find((product) => availableProduct(product, reuseState));
  if (direct) return direct;
  const matches = new Map();
  for (const row of rows) {
    const variantCandidates = [
      index.byVariantSourceKey.get(variantSourceKeyFor(row.normalizedData)),
      index.byVariantSourceKey.get(legacyVariantSourceKeyFor(row.normalizedData)),
    ];
    const product = variantCandidates.find((candidate) => availableProduct(candidate, reuseState));
    if (product) matches.set(product.id, product);
  }
  return matches.size === 1 ? [...matches.values()][0] : null;
};

const previousProductForRows = (rows, index, operation, reuseState = null, { claim = false } = {}) => {
  for (const row of rows) {
    const data = { ...row.normalizedData, operation };
    const directCandidates = [
      index.byProductSourceKey.get(productSourceKeyFor(data)),
      index.byProductSourceKey.get(legacyProductSourceKeyFor(data)),
    ];
    const direct = directCandidates.find((product) => availableProduct(product, reuseState));
    if (direct) return claim ? claimProduct(direct, reuseState) : direct;
  }
  const enriched = enrichmentForRows(rows, index, reuseState);
  return claim ? claimProduct(enriched, reuseState) : enriched;
};

const previousVariantFor = (variantData, previousProduct, index, reuseState) => {
  if (!previousProduct) return null;
  const candidates = [
    index.byVariantRecordSourceKey.get(variantData.variantSourceKey),
    index.byVariantRecordSourceKey.get(legacyVariantSourceKeyFor(variantData)),
  ];
  const variant = candidates.find((candidate) => (
    candidate
    && candidate.productId === previousProduct.id
    && !reuseState.claimedVariantIds.has(candidate.id)
  ));
  if (!variant) return null;
  reuseState.claimedVariantIds.add(variant.id);
  return variant;
};

const uniqueSlugFor = (preferredSlug, name, sourceKey, usedSlugs) => {
  const preferred = nonEmpty(preferredSlug) ? preferredSlug : slugFor(name, sourceKey);
  if (!usedSlugs.has(preferred)) {
    usedSlugs.add(preferred);
    return preferred;
  }
  const generated = slugFor(name, sourceKey);
  if (!usedSlugs.has(generated)) {
    usedSlugs.add(generated);
    return generated;
  }
  const fallback = `${generated}-${sha([sourceKey, preferred]).slice(-8)}`;
  usedSlugs.add(fallback);
  return fallback;
};

const resolveImage = async ({ pathValue, mediaAssetRepository }) => {
  if (!/^\/(?:images|uploads)\//.test(String(pathValue ?? '')) || String(pathValue).includes('..')) return { path: undefined, mediaId: undefined };
  const asset = await mediaAssetRepository?.getById?.(pathValue);
  return { path: pathValue, mediaId: asset?.id };
};

export const resolveProviderRows = ({ rows, offers }) => {
  const offersByWmid = new Map();
  for (const offer of offers) {
    const matches = offersByWmid.get(offer.wmproductId) ?? [];
    matches.push(offer);
    offersByWmid.set(offer.wmproductId, matches);
  }
  return rows.map((row) => {
    const existingErrors = row.errors ?? [];
    const errors = existingErrors.filter((error) => !PROVIDER_WARNING_CODES.has(error?.code));
    const warnings = [
      ...(row.warnings ?? []),
      ...existingErrors.filter((error) => PROVIDER_WARNING_CODES.has(error?.code)),
    ];
    const wmproductId = row.normalizedData?.wmproductId;
    const matches = wmproductId ? (offersByWmid.get(wmproductId) ?? []) : [];
    if (!wmproductId && !errors.some((error) => error.code === 'MISSING_WMID')) errors.push({ code: 'MISSING_WMID', field: 'wmproductId' });
    const providerResolution = !wmproductId
      ? PROVIDER_RESOLUTIONS.UNRESOLVED
      : matches.length === 0
        ? PROVIDER_RESOLUTIONS.UNRESOLVED
        : matches.length > 1
          ? PROVIDER_RESOLUTIONS.AMBIGUOUS
          : matches[0].active === false
            ? PROVIDER_RESOLUTIONS.INACTIVE
            : PROVIDER_RESOLUTIONS.RESOLVED;
    if (wmproductId && providerResolution === PROVIDER_RESOLUTIONS.UNRESOLVED) warnings.push({ code: 'PROVIDER_NOT_FOUND', field: 'wmproductId' });
    if (providerResolution === PROVIDER_RESOLUTIONS.AMBIGUOUS) warnings.push({ code: 'PROVIDER_AMBIGUOUS', field: 'wmproductId' });
    if (providerResolution === PROVIDER_RESOLUTIONS.INACTIVE) warnings.push({ code: 'PROVIDER_INACTIVE', field: 'wmproductId' });
    const providerOffer = matches.length === 1 && matches[0].active !== false ? matches[0] : null;
    if (providerOffer?.apnHint && row.normalizedData?.apn && normalizeToken(providerOffer.apnHint) !== normalizeToken(row.normalizedData.apn)) errors.push({ code: 'APN_PROVIDER_CONFLICT', field: 'apn' });
    if (providerOffer?.networkLabel && row.normalizedData?.networkLabel && normalizeToken(providerOffer.networkLabel) !== normalizeToken(row.normalizedData.networkLabel)) errors.push({ code: 'NETWORK_PROVIDER_CONFLICT', field: 'networkLabel' });
    return {
      ...row,
      errors,
      warnings,
      status: errors.length ? 'INVALID' : 'VALID',
      providerResolution,
      providerOffer,
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
  const mergedCategories = mergeCatalogCategories(categories, cloneSeedCategories());
  const preparedRows = resolveProviderRows({ rows, offers });
  const validRows = preparedRows.filter((row) => row.status === 'VALID');
  const index = createEnrichmentIndex(previousCatalog ?? {});
  const familyGroups = new Map();
  for (const row of validRows) {
    const packageClass = row.normalizedData.packageClass ?? classifyHicoPackageClass(row.normalizedData.sourceCategoryLabel);
    const packageFamilyKey = packageFamilyKeyFor({ ...row.normalizedData, packageClass });
    row.normalizedData = { ...row.normalizedData, packageClass, packageFamilyKey };
    const key = `${packageFamilyKey}:${row.sourceMedium}`;
    familyGroups.set(key, [...(familyGroups.get(key) ?? []), row]);
  }
  const packageFamilyMediums = new Map();
  for (const row of validRows) {
    const packageFamilyKey = row.normalizedData.packageFamilyKey;
    packageFamilyMediums.set(packageFamilyKey, new Set([
      ...(packageFamilyMediums.get(packageFamilyKey) ?? []),
      row.sourceMedium,
    ]));
  }
  const packageFamilyDiagnostics = {
    uniqueFamilies: packageFamilyMediums.size,
    mediumGroups: familyGroups.size,
    familiesWithBothMediums: [...packageFamilyMediums.values()].filter((mediums) => mediums.has('physical_sim') && mediums.has('esim')).length,
    physicalOnlyFamilies: [...packageFamilyMediums.values()].filter((mediums) => mediums.has('physical_sim') && !mediums.has('esim')).length,
    esimOnlyFamilies: [...packageFamilyMediums.values()].filter((mediums) => mediums.has('esim') && !mediums.has('physical_sim')).length,
    otherMediumFamilies: [...packageFamilyMediums.values()].filter((mediums) => !mediums.has('physical_sim') && !mediums.has('esim')).length,
  };
  const groups = new Map();
  for (const familyRows of familyGroups.values()) {
    const operationGroups = new Map();
    for (const row of familyRows) {
      const previousProduct = previousProductForRows([row], index, 'new_subscription')
        ?? previousProductForRows([row], index, 'topup')
        ?? previousProductForRows([row], index, 'device_sale');
      const evidence = operationEvidenceFor({
        sourceCategoryLabel: row.normalizedData.sourceCategoryLabel,
        packageClass: row.normalizedData.packageClass,
        providerOffer: row.providerOffer,
        previousOperation: previousProduct?.operation,
      });
      row.operationEvidence = evidence;
      const key = `${row.normalizedData.packageFamilyKey}:${row.sourceMedium}:${evidence.operation}`;
      operationGroups.set(key, [...(operationGroups.get(key) ?? []), row]);
    }
    for (const operationRows of operationGroups.values()) {
      const operation = operationRows[0].operationEvidence.operation;
      const operationResolution = operationRows.every((row) => row.operationEvidence.resolution === 'RESOLVED') ? 'RESOLVED' : 'UNRESOLVED';
      for (const row of operationRows) {
        if (row.operationEvidence.resolution !== 'RESOLVED') row.warnings.push({ code: 'OPERATION_UNRESOLVED', field: 'simType' });
        const sourceKey = productSourceKeyFor({ ...row.normalizedData, operation, medium: row.sourceMedium });
        row.normalizedData = {
          ...row.normalizedData,
          operation,
          operationResolution,
          sourceKey,
          variantSourceKey: variantSourceKeyFor({ ...row.normalizedData, operation, medium: row.sourceMedium }),
        };
        const key = sourceKey;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
    }
  }
  const products = [];
  const variants = [];
  const reuseState = createEnrichmentReuseState();
  let exactDuplicatesCollapsed = 0;
  let groupingCollisions = 0;
  const enrichment = {
    imagesReused: 0, imagesFromSheet: 0, imagesFallback: 0,
    descriptionsReused: 0, descriptionsFromSheet: 0, descriptionsFallback: 0,
    installationGuideReused: 0, installationGuideFromSheet: 0, installationGuideFallback: 0,
  };
  for (const groupRows of groups.values()) {
    const variantsByKey = new Map();
    const retainedRows = [];
    for (const row of groupRows) {
      const key = row.normalizedData.variantSourceKey;
      const existing = variantsByKey.get(key);
      if (!existing) {
        variantsByKey.set(key, row);
        retainedRows.push(row);
        continue;
      }
      if (JSON.stringify(existing.normalizedData) === JSON.stringify(row.normalizedData)) {
        exactDuplicatesCollapsed += 1;
        existing.warnings.push({ code: 'DUPLICATE_IDENTICAL_COLLAPSED', field: 'variantSourceKey' });
      } else {
        groupingCollisions += 1;
        existing.errors.push({ code: 'PACKAGE_VARIANT_COLLISION', field: 'variantSourceKey' });
        row.errors.push({ code: 'PACKAGE_VARIANT_COLLISION', field: 'variantSourceKey' });
        existing.status = 'INVALID';
        row.status = 'INVALID';
        const indexOfExisting = retainedRows.indexOf(existing);
        if (indexOfExisting >= 0) retainedRows.splice(indexOfExisting, 1);
      }
    }
    groupRows.splice(0, groupRows.length, ...retainedRows);
    if (groupRows.length === 0) continue;
    const first = groupRows[0];
    const data = first.normalizedData;
    const previousProduct = previousProductForRows(groupRows, index, data.operation, reuseState, { claim: true });
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
    const operation = data.operation;
    const operationResolution = data.operationResolution ?? 'UNRESOLVED';
    const packageClass = data.packageClass ?? 'UNKNOWN';
    const categoryId = categoryIdForPackage(packageClass, first.sourceMedium, operation);
    const coverageLabels = [...new Set(groupRows.map((row) => row.normalizedData.coverageLabel).filter(nonEmpty))];
    const coverageDestinations = [...new Map(groupRows
      .flatMap((row) => row.normalizedData.coverage?.destinations ?? [])
      .filter((destination) => destination?.id && destination?.name)
      .map((destination) => [destination.id, { id: destination.id, name: destination.name }])).values()];
    const coverageFilters = coverageDestinations.map((destination) => ({
      rawLabel: destination.name,
      normalizedLabel: normalizeToken(destination.name),
      id: destination.id,
    }));
    const coverageIds = coverageDestinations.map((destination) => destination.id);
    const previousCoverageIds = Array.isArray(previousProduct?.coverageIds) ? [...previousProduct.coverageIds] : [];
    const effectiveCoverageIds = coverageIds.length > 0 ? coverageIds : previousCoverageIds;
    const effectiveCoverageType = effectiveCoverageIds.length > 1
      ? 'region'
      : effectiveCoverageIds.length === 1
        ? 'country'
        : previousProduct?.coverageType ?? 'not_applicable';
    const dataPolicy = uniqueValue(groupRows, 'dataPolicy');
    const networks = [...new Set(groupRows.flatMap((row) => row.normalizedData.coverage?.networks ?? []).filter(nonEmpty))];
    const networkValue = networks.join(', ');
    const coverageStatuses = new Set(groupRows.map((row) => {
      const coverage = row.normalizedData.coverage;
      if (coverage?.status) return coverage.status;
      if (coverage?.carrierOnly) return 'CARRIER_ONLY';
      if (Array.isArray(coverage?.destinations) && coverage.destinations.length > 0) return coverage.needsReview ? 'PARTIAL' : 'RESOLVED';
      return 'MISSING';
    }));
    const coverageStatus = coverageStatuses.has('UNKNOWN_DESTINATION')
      ? 'UNKNOWN_DESTINATION'
      : coverageStatuses.has('CARRIER_ONLY')
        ? 'CARRIER_ONLY'
        : coverageStatuses.has('PARTIAL')
          ? 'PARTIAL'
          : coverageStatuses.has('UNRESOLVED')
            ? 'UNRESOLVED'
            : coverageStatuses.has('RESOLVED')
              ? 'RESOLVED'
              : 'MISSING';
    const coverageNeedsReview = coverageStatus !== 'RESOLVED';
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
      categoryId,
      categoryNeedsReview: !categoryId || packageClass === 'UNKNOWN',
      coverageType: effectiveCoverageType,
      coverageIds: effectiveCoverageIds,
      ...(coverageFilters.length ? { coverageFilter: coverageFilters.length === 1 ? coverageFilters[0] : coverageFilters } : {}),
      ...(coverageLabels.length === 1 ? { coverageLabel: coverageLabels[0] } : {}),
      ...(coverageLabels.length ? { rawCoverageLabels: coverageLabels } : {}),
      ...(coverageDestinations.length ? { coverageDestinations } : {}),
      coverageStatus,
      coverageNeedsReview,
      ...(networkValue ? { networkLabel: networkValue } : {}),
      ...image,
      ...(previousProduct?.featured !== undefined ? { featured: previousProduct.featured } : { featured: false }),
      ...(previousProduct?.seoTitle ? { seoTitle: previousProduct.seoTitle } : {}),
      ...(previousProduct?.seoDescription ? { seoDescription: previousProduct.seoDescription } : {}),
      ...(previousProduct?.seoKeywords ? { seoKeywords: previousProduct.seoKeywords } : {}),
      id: productId,
      sourceKey: productSourceKey,
      packageFamilyKey: data.packageFamilyKey,
      packageClass,
      sourceCategoryLabel: data.sourceCategoryLabel,
      medium: first.sourceMedium,
      operationResolution,
      ...(dataPolicy && !dataPolicy.conflict && dataPolicy !== undefined ? { dataPolicy } : {}),
      slug: uniqueSlugFor(previousProduct?.slug, data.productName, productSourceKey, reuseState.usedSlugs),
      name: data.productName,
      operation,
      description: productDescription,
      installationGuide: productInstallationGuide,
      status: 'draft',
      version: 1,
      createdAt: previousProduct?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    for (const row of groupRows) {
      const variantData = row.normalizedData;
      const previousVariant = previousVariantFor(variantData, previousProduct, index, reuseState);
      const fulfillment = fulfillmentFor(row.providerOffer, row.sourceMedium, operation);
      variants.push({
        ...(previousVariant?.publicSku ? { publicSku: previousVariant.publicSku } : {}),
        id: previousVariant?.id ?? `variant-${sha(variantData.variantSourceKey)}`,
        sourceKey: variantData.variantSourceKey,
        productId,
        sku: variantData.sku,
        dataPolicy: variantData.dataPolicy,
        dataLimit: variantData.dataLimit,
        duration: variantData.duration,
        ...(variantData.durationValue !== undefined ? { durationValue: variantData.durationValue } : {}),
        ...(variantData.durationUnit ? { durationUnit: variantData.durationUnit } : {}),
        ...(variantData.tripDayOptions ? { tripDayOptions: variantData.tripDayOptions } : {}),
        price: variantData.price ?? 0,
        compareAtPrice: variantData.compareAtPrice ?? null,
        currency: 'VND',
        medium: variantData.medium,
        packageFamilyKey: variantData.packageFamilyKey,
        operationResolution,
        ...fulfillment,
        providerResolution: row.providerResolution ?? PROVIDER_RESOLUTIONS.UNRESOLVED,
        ...(variantData.wmproductId ? { wmproductId: variantData.wmproductId } : {}),
        ...(row.providerOffer ? { providerOfferId: row.providerOffer.id, wmproductId: row.providerOffer.wmproductId } : {}),
        ...(row.providerOffer?.providerProductId ? { providerProductId: row.providerOffer.providerProductId } : {}),
        ...(variantData.activationPolicy ? { activationPolicy: variantData.activationPolicy } : {}),
        ...(variantData.networkLabel ? { networkLabel: variantData.networkLabel } : {}),
        ...(variantData.rawCoverageLabel ? { coverageLabel: variantData.rawCoverageLabel } : {}),
        ...(variantData.apn ? { apnGuidance: variantData.apn } : {}),
        ...(variantData.publicNote ? { publicNote: variantData.publicNote } : {}),
        ...(variantData.speedLabel ? { speedLabel: variantData.speedLabel } : {}),
        ...(typeof variantData.cancellable === 'boolean' ? { cancellable: variantData.cancellable } : {}),
        shippingRequired: operation === 'new_subscription' && row.sourceMedium === 'physical_sim',
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
  assertCanonicalCatalog({ products, variants: safeVariants, categories: mergedCategories, providerOffers: offers, manualQrs: [] });
  const provider = safeVariants.reduce((summary, variant) => {
    const resolution = variant.providerResolution ?? PROVIDER_RESOLUTIONS.UNRESOLVED;
    if (resolution === PROVIDER_RESOLUTIONS.RESOLVED) summary.resolved += 1;
    if (resolution === PROVIDER_RESOLUTIONS.UNRESOLVED) summary.unresolved += 1;
    if (resolution === PROVIDER_RESOLUTIONS.AMBIGUOUS) summary.ambiguous += 1;
    if (resolution === PROVIDER_RESOLUTIONS.INACTIVE) summary.inactive += 1;
    if (variant.needsReview === true) summary.needsReviewVariants += 1;
    return summary;
  }, { resolved: 0, unresolved: 0, ambiguous: 0, inactive: 0, needsReviewVariants: 0 });
  return {
    products,
    variants: safeVariants,
    rows: preparedRows,
    summary: {
      products: products.length,
      variants: safeVariants.length,
      invalidRows: preparedRows.filter((row) => row.status === 'INVALID').length,
      validRows: validRows.length,
      uniqueProductKeys: groups.size,
      packageFamilies: packageFamilyDiagnostics.uniqueFamilies,
      packageFamilyMediumGroups: packageFamilyDiagnostics.mediumGroups,
      packageFamilyDiagnostics,
      exactDuplicatesCollapsed,
      groupingCollisions,
      operationUnresolved: preparedRows.filter((row) => row.operationEvidence?.resolution === 'UNRESOLVED').length,
      operations: Object.fromEntries([...new Set(products.map((product) => product.operation))].map((operation) => [operation, products.filter((product) => product.operation === operation).length])),
      mediums: Object.fromEntries([...new Set(variants.map((variant) => variant.medium ?? 'none'))].map((medium) => [medium, variants.filter((variant) => (variant.medium ?? 'none') === medium).length])),
      coverageFilters: [...new Set(products.flatMap((product) => product.coverageIds ?? []))],
      packageClasses: Object.fromEntries([...new Set(products.map((product) => product.packageClass ?? 'UNKNOWN'))].map((packageClass) => [packageClass, products.filter((product) => (product.packageClass ?? 'UNKNOWN') === packageClass).length])),
      categoryCounts: Object.fromEntries([...new Set(products.map((product) => product.categoryId ?? 'UNCLASSIFIED'))].map((categoryId) => [categoryId, products.filter((product) => (product.categoryId ?? 'UNCLASSIFIED') === categoryId).length])),
      coverage: (() => {
        const summary = products.reduce((result, product) => {
          if (product.coverageNeedsReview) result.coverageNeedsReviewProducts += 1;
          const status = product.coverageStatus ?? (product.coverageNeedsReview ? 'NEEDS_REVIEW' : 'RESOLVED');
          result.statusCounts[status] = (result.statusCounts[status] ?? 0) + 1;
          for (const destination of product.coverageDestinations ?? []) {
            result.uniqueDestinations.add(destination.id);
            result.destinationNames[destination.id] = destination.name;
            result.destinationCounts[destination.id] = (result.destinationCounts[destination.id] ?? 0) + 1;
          }
          return result;
        }, { coverageNeedsReviewProducts: 0, uniqueDestinations: new Set(), destinationNames: {}, destinationCounts: {}, statusCounts: {} });
        return {
          coverageNeedsReviewProducts: summary.coverageNeedsReviewProducts,
          uniqueDestinations: [...summary.uniqueDestinations].sort(),
          uniqueDestinationNames: Object.fromEntries([...summary.uniqueDestinations].sort().map((id) => [id, summary.destinationNames[id]])),
          statusCounts: summary.statusCounts,
          topDestinations: Object.entries(summary.destinationCounts)
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 20)
            .map(([id, count]) => ({ id, count })),
        };
      })(),
      sourceClassification: classifyHicoGocSourceRows(preparedRows),
      rejectionReasons: rejectionReasonsForRows(preparedRows),
      provider,
      ...enrichment,
    },
    categories: mergedCategories,
  };
};

export const sourceHashFor = (reference, settings, offers) => createHash('sha256').update(JSON.stringify({
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
    if (String(reference.sheetTab ?? '').normalize('NFC').trim() !== HICO_GOC_SHEET) throw new SheetSyncError(`Full sync yêu cầu tab ${HICO_GOC_SHEET}.`, { code: 'SHEET_SOURCE_TAB_INVALID', status: 422 });
    const headers = reference.values?.[0];
    if (!Array.isArray(headers) || headers.length === 0) throw new SheetSyncError('HICO GỐC không có header để đối chiếu mapping.', { code: 'SHEET_HEADER_REQUIRED', status: 422 });
    const range = validateHicoGocRange({ sheetRange: reference.sheetRange, headers, fieldMapping: settings.fieldMapping });
    const headerHash = hicoGocHeaderHash(headers);
    if (settings.headerHash && settings.headerHash !== headerHash) throw new SheetSyncError('HICO GỐC header đã thay đổi sau khi lưu mapping.', { code: 'SHEET_HEADER_CHANGED', status: 409 });
    return { headerHash, range };
  };
  const build = async ({ reference, settings, current, previousCatalog, offers }) => {
    const validation = validateReference(reference, settings);
    const parsed = parseHicoGocRowsWithDiagnostics(reference.values, settings);
    const collapsed = collapseHicoGocRows(parsed.rows);
    const candidate = await buildFullSyncCandidate({ rows: collapsed, categories: current.categories ?? cloneSeedCategories(), offers, previousCatalog, now, mediaAssetRepository });
    const diagnostics = fullSyncDiagnostics({ reference, range: validation.range, parser: parsed.diagnostics, candidate, baselineCatalog: current.products.length > 0 ? current : previousCatalog });
    assertFullSyncCandidate(diagnostics);
    return { candidate, diagnostics };
  };
  return {
    async fullPreview({ actor = {} } = {}) {
      const reference = await referenceClient.readRows();
      const initialSettings = {
        ...normalizeHicoGocSettings(reference.syncSettings ?? {}),
        headerRow: Number(reference.syncSettings?.headerRow ?? 1),
      };
      const validation = validateReference(reference, initialSettings);
      const settings = { ...initialSettings, headerHash: validation.headerHash };
      const [current, offers] = await Promise.all([
        canonicalRepository.readCatalog({ required: true }),
        providerRepository.listOffers(),
      ]);
      const previousCatalog = await loadPreviousCatalog({ current });
      const sourceHash = sourceHashFor(reference, settings, offers);
      const existing = await repository.findBySourceHash(sourceHash);
      if (existing) {
        if (existing.mode === 'full') assertPersistedFullSyncSummary(existing.summary);
        return { batch: publicBatch(existing), rows: (await repository.listRows(existing.id)).map(publicRow), idempotent: true };
      }
      const candidate = await build({ reference, settings, current, previousCatalog, offers });
      const summary = {
        total: candidate.candidate.rows.length,
        valid: candidate.candidate.rows.filter((row) => row.status === 'VALID').length,
        invalid: candidate.candidate.rows.filter((row) => row.status === 'INVALID').length,
        headerRow: settings.headerRow,
        changedFields: 0,
        enrichmentSourceVersionId: currentVersion(previousCatalog.manifest),
        ...candidate.candidate.summary,
        diagnostics: candidate.diagnostics,
      };
      const batch = {
        id: idFactory(), mode: 'full', sourceHash, providerSnapshotHash: providerSnapshotHashFor(offers),
        spreadsheetId: reference.spreadsheetId, sheetTab: reference.sheetTab, sheetRange: reference.sheetRange,
        status: 'READY_FOR_REVIEW', createdBy: actor.id ?? null, createdAt: now().toISOString(), validatedAt: now().toISOString(),
        catalogVersionId: currentVersion(current.manifest), fieldMapping: settings.fieldMapping, priceMapping: settings.priceMapping,
        headerHash: settings.headerHash, summary,
      };
      const rows = candidate.candidate.rows.map((row) => ({ ...row, id: idFactory(), variantId: null, raw: undefined, diff: {}, appliedFields: [], createdAt: now().toISOString() }));
      await repository.createBatch(batch, rows);
      logger.info?.('[catalog-full-sync] preview', { batchId: batch.id, products: summary.products, variants: summary.variants, invalidRows: summary.invalid });
      return { batch: publicBatch(batch), rows: rows.map(publicRow), idempotent: false };
    },

    async fullApply(id, { actor = {} } = {}) {
      const batch = await repository.getBatch(id);
      if (!batch || batch.mode !== 'full') throw new SheetSyncError('Full sync batch was not found.', { code: 'SHEET_BATCH_NOT_FOUND', status: 404 });
      assertPersistedFullSyncSummary(batch.summary);
      if (['APPLIED', 'PARTIALLY_APPLIED'].includes(batch.status)) return { batch: publicBatch(batch), rows: (await repository.listRows(id)).map(publicRow), versionId: batch.catalogVersionId, idempotent: true };
      const reference = await referenceClient.readRows();
      const settings = {
        ...normalizeHicoGocSettings({ fieldMapping: batch.fieldMapping, priceMapping: batch.priceMapping, headerHash: batch.headerHash }),
        headerRow: Number(batch.headerRow ?? batch.summary?.headerRow ?? 1),
      };
      const [current, offers] = await Promise.all([canonicalRepository.readCatalog({ required: true }), providerRepository.listOffers()]);
      if (currentVersion(current.manifest) !== batch.catalogVersionId) throw new SheetSyncError('Catalog đã thay đổi sau preview. Hãy tạo lại preview.', { code: 'SHEET_SYNC_CONCURRENCY_CONFLICT', status: 409 });
      if (sourceHashFor(reference, settings, offers) !== batch.sourceHash) throw new SheetSyncError('Sheet, mapping hoặc provider snapshot đã thay đổi sau preview.', { code: 'SHEET_SYNC_STALE_PREVIEW', status: 409 });
      if (batch.providerSnapshotHash && providerSnapshotHashFor(offers) !== batch.providerSnapshotHash) throw new SheetSyncError('Provider snapshot đã thay đổi sau preview.', { code: 'PROVIDER_SNAPSHOT_CHANGED', status: 409 });
      const rows = await repository.listRows(id);
      if (rows.some((row) => row.status === 'INVALID')) throw new SheetSyncError('Full sync đang có dòng lỗi; chưa ghi catalog.', { code: 'FULL_SYNC_INVALID_ROWS', status: 422, details: { invalidRows: rows.filter((row) => row.status === 'INVALID').length } });
      const previousCatalog = await loadPreviousCatalog({ current, requestedVersionId: batch.summary?.enrichmentSourceVersionId });
      const prepared = await build({ reference: { ...reference }, settings, current, previousCatalog, offers });
      const claimed = await repository.claimForApply(id, actor.id);
      if (!claimed) throw new SheetSyncError('Full sync đang được xử lý hoặc không còn ở trạng thái review.', { code: 'SHEET_SYNC_APPLY_IN_PROGRESS', status: 409 });
      const manualQrs = await readManualQrs(uploadsDirectory);
      const newVersionId = `catalog-full-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const createdAt = now().toISOString();
      const audit = {
        id: `audit-${randomUUID()}`, actorId: actor.id, actorEmail: actor.email, action: 'CATALOG_FULL_SYNC', entityType: 'catalog', entityId: batch.id,
        sourceSheet: HICO_GOC_SHEET, previousVersionId: currentVersion(current.manifest), enrichmentSourceVersionId: currentVersion(previousCatalog.manifest),
        newVersionId, products: prepared.candidate.summary.products, variants: prepared.candidate.summary.variants,
        imagesReused: prepared.candidate.summary.imagesReused, imagesFromSheet: prepared.candidate.summary.imagesFromSheet, imagesFallback: prepared.candidate.summary.imagesFallback,
        descriptionsReused: prepared.candidate.summary.descriptionsReused, descriptionsFromSheet: prepared.candidate.summary.descriptionsFromSheet, descriptionsFallback: prepared.candidate.summary.descriptionsFallback,
        installationGuideReused: prepared.candidate.summary.installationGuideReused, installationGuideFromSheet: prepared.candidate.summary.installationGuideFromSheet, installationGuideFallback: prepared.candidate.summary.installationGuideFallback,
        createdAt,
      };
      try {
        const committed = await commitService.commit({
          versionId: newVersionId, parentVersionId: currentVersion(current.manifest), products: prepared.candidate.products, variants: prepared.candidate.variants,
          categories: prepared.candidate.categories, providerOffers: offers, manualQrs, commandType: 'CATALOG_FULL_SYNC', commandId: id,
          requestHash: batch.sourceHash, createdAt,
          beforePointer: () => auditRepository.append(audit),
          rollbackBeforePointer: () => auditRepository.remove(audit.id),
        });
        const appliedAt = now().toISOString();
        await repository.updateRows(id, Object.fromEntries(rows.map((row) => [row.id, { status: 'APPLIED', appliedFields: ['fullCatalog'], appliedAt }])));
        const nextBatch = await repository.updateBatch(id, { status: 'APPLIED', summary: { ...batch.summary, ...prepared.candidate.summary, diagnostics: prepared.diagnostics }, appliedAt, catalogVersionId: committed.manifest.versionId });
        return { batch: publicBatch(nextBatch), rows: (await repository.listRows(id)).map(publicRow), versionId: committed.manifest.versionId, idempotent: false };
      } catch (error) {
        await repository.updateBatch(id, { status: 'READY_FOR_REVIEW', summary: batch.summary });
        throw error;
      }
    },
  };
};

export { PLACEHOLDER_IMAGES, FALLBACK_INSTALLATION_GUIDE };
