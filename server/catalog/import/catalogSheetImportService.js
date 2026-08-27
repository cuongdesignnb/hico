import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { sha256 } from '../canonical/canonicalCatalogChecksum.js';
import { assertCanonicalCatalog } from '../canonical/canonicalCatalogValidation.js';
import { categoryById, isLeafCategory, operationForCategoryKind } from '../categories/catalogCategories.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { publicSkuForVariantId } from '../public/publicSku.js';
import { createCatalogAuditRepository } from '../write/catalogAuditRepository.js';
import { createCatalogCommandService } from '../write/catalogCommandService.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import { atomicWriteJson, defaultUploadsDirectory, readJson } from '../write/catalogWritePersistence.js';
import { assertCatalogBaseVersion, CatalogWriteError, requireCatalogVersionId, requireNonEmptyString, requireObject } from '../write/catalogWriteValidation.js';
import { mapCatalogImportRows, parseCatalogImportText } from './catalogImportParser.js';

const PREVIEW_TTL = 30 * 60 * 1000;
const currentVersion = (manifest) => manifest?.versionId ?? manifest?.migrationId;
const slugify = (value) => value.replace(/[Đđ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'san-pham';
const nowIso = () => new Date().toISOString();

const providerFields = (category, offer) => {
  if (category.kind === 'esim' && offer.providerProductType === 0 && typeof offer.leSIM === 'boolean') return { medium: 'esim', supplier: 'worldmove', fulfillmentMethod: offer.leSIM === false ? 'WORLDMOVE_ESIM_ORDER_THEN_REDEEM' : 'WORLDMOVE_ESIM_REDEEM', providerProductType: 0, leSIM: offer.leSIM, requiresExistingSim: false };
  return null;
};

const hicoFields = (category, sourceMode) => {
  if (sourceMode === 'hico_manual_qr' && category.kind === 'esim') return { medium: 'esim', supplier: 'hico', fulfillmentMethod: 'HICO_MANUAL_QR', providerProductType: null, leSIM: null, requiresExistingSim: false };
  if (sourceMode === 'hico_physical' && ['physical_sim', 'device', 'accessory'].includes(category.kind)) return { medium: 'physical_sim', supplier: 'hico', fulfillmentMethod: 'HICO_PHYSICAL_STOCK', providerProductType: null, leSIM: null, requiresExistingSim: false };
  if (sourceMode === 'manual_processing') return { medium: null, supplier: 'other', fulfillmentMethod: 'MANUAL_PROCESSING', providerProductType: null, leSIM: null, requiresExistingSim: false };
  return null;
};

const normalizeCoverage = (row, category) => {
  const coverageType = row.coverageType || (['device', 'accessory'].includes(category.kind) ? 'not_applicable' : 'country');
  if (!['country', 'region', 'global', 'not_applicable'].includes(coverageType)) return { error: 'coverageType không hợp lệ.' };
  if (coverageType === 'country' && !row.coverageId) return { error: 'Coverage quốc gia cần coverageId.' };
  if (coverageType === 'region' && !row.coverageId) return { error: 'Coverage khu vực cần coverageId.' };
  return { coverageType, coverageIds: coverageType === 'not_applicable' ? [] : coverageType === 'global' ? ['global'] : [row.coverageId] };
};

export const createCatalogSheetImportService = ({
  env = process.env,
  uploadsDirectory = defaultUploadsDirectory,
  catalogRepository = createCanonicalCatalogRepository({ uploadsDirectory }),
  providerRepository = createProviderOfferRepository(),
  commitService = createCatalogVersionCommitService({ uploadsDirectory }),
  commandService = createCatalogCommandService({ env }),
  auditRepository = createCatalogAuditRepository({ recordsFile: path.join(uploadsDirectory, 'catalog_audit.json') }),
  now = () => new Date(),
} = {}) => {
  const previewsFile = path.join(uploadsDirectory, 'catalog_import_previews.json');
  const readContext = async () => ({ ...(await catalogRepository.readCatalog({ required: true })), providerOffers: await providerRepository.listOffers() });
  const savePreview = async (preview) => {
    const records = await readJson(previewsFile, []);
    await atomicWriteJson(previewsFile, [...records.filter((item) => Date.parse(item.expiresAt) > Date.now() && item.previewId !== preview.previewId), preview]);
  };
  const getPreview = async (previewId) => {
    const preview = (await readJson(previewsFile, [])).find((item) => item.previewId === previewId);
    if (!preview || Date.parse(preview.expiresAt) <= Date.now()) throw new CatalogWriteError('Import preview không tồn tại hoặc đã hết hạn.', { status: 404, code: 'IMPORT_PREVIEW_NOT_FOUND' });
    return preview;
  };

  const evaluate = ({ request, context }) => {
    const category = categoryById(context.categories, request.categoryId);
    if (!category || category.status !== 'active' || !isLeafCategory(category, context.categories)) throw new CatalogWriteError('Hãy chọn một danh mục con đang hoạt động.', { code: 'CATEGORY_INVALID' });
    const parsed = parseCatalogImportText(request.text);
    const rows = mapCatalogImportRows({ parsed, columnMap: request.columnMap });
    const sourceMode = request.sourceMode ?? 'worldmove';
    const offersByWmid = new Map();
    for (const offer of context.providerOffers) {
      const matches = offersByWmid.get(offer.wmproductId) ?? [];
      matches.push(offer); offersByWmid.set(offer.wmproductId, matches);
    }
    const existingSkus = new Set(context.variants.map((variant) => variant.sku.trim().toUpperCase()));
    const importedSkus = new Set();
    const errorsByRow = new Map();
    const addErrors = (rowNumber, sku, rowErrors) => {
      if (!rowErrors.length) return;
      const current = errorsByRow.get(rowNumber) ?? { rowNumber, sku, errors: [] };
      current.errors = [...new Set([...current.errors, ...rowErrors])];
      errorsByRow.set(rowNumber, current);
    };
    const normalized = rows.map((row) => {
      const rowErrors = [];
      if (!row.family) rowErrors.push('Thiếu họ gói.');
      if (!row.productName) rowErrors.push('Thiếu tên Product.');
      if (!row.sku) rowErrors.push(sourceMode === 'worldmove' ? 'Thiếu WMID.' : 'Thiếu SKU.');
      const skuKey = row.sku?.toUpperCase();
      if (skuKey && (existingSkus.has(skuKey) || importedSkus.has(skuKey))) rowErrors.push('SKU/WMID đã tồn tại hoặc bị trùng trong import.');
      if (skuKey) importedSkus.add(skuKey);
      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) rowErrors.push('Giá bán VND phải lớn hơn 0.');
      const compareAtPrice = row.compareAtPrice ? Number(row.compareAtPrice) : null;
      if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) rowErrors.push('Giá so sánh không hợp lệ.');
      const coverage = normalizeCoverage(row, category);
      if (coverage.error) rowErrors.push(coverage.error);
      let offer = null;
      let fulfillment = null;
      if (sourceMode === 'worldmove') {
        const matches = (offersByWmid.get(row.sku) ?? []).filter((item) => item.active);
        if (matches.length === 0) rowErrors.push('PROVIDER_NOT_FOUND');
        else if (matches.length > 1) rowErrors.push('PROVIDER_AMBIGUOUS');
        else {
          offer = matches[0];
          fulfillment = providerFields(category, offer);
          if (!fulfillment) {
            rowErrors.push([1, 2].includes(offer.providerProductType)
              ? 'PROVIDER_PRODUCT_TYPE_UNSUPPORTED'
              : 'PROVIDER_TYPE_CONFLICT');
          }
        }
      } else {
        fulfillment = hicoFields(category, sourceMode);
        if (!fulfillment) rowErrors.push('SOURCE_CATEGORY_MISMATCH');
      }
      addErrors(row.rowNumber, row.sku, rowErrors);
      return { ...row, price, compareAtPrice, coverage, offer, fulfillment };
    });
    const families = new Map();
    for (const row of normalized) {
      if (!row.family) continue;
      const current = families.get(row.family) ?? { family: row.family, productName: row.productName, coverageType: row.coverage.coverageType, coverageIds: row.coverage.coverageIds, rows: [] };
      if (current.coverageType !== row.coverage.coverageType || JSON.stringify(current.coverageIds) !== JSON.stringify(row.coverage.coverageIds)) addErrors(row.rowNumber, row.sku, ['Các variant cùng họ gói phải có cùng coverage.']);
      current.rows.push(row); families.set(row.family, current);
    }
    return { category, sourceMode, headers: parsed.headers, rows: normalized, families: [...families.values()], errors: [...errorsByRow.values()] };
  };

  return {
    async preview(request, actor = {}) {
      requireObject(request, 'request');
      const catalogVersionId = requireCatalogVersionId(request.catalogVersionId);
      const context = await readContext();
      assertCatalogBaseVersion(catalogVersionId, currentVersion(context.manifest));
      const evaluation = evaluate({ request, context });
      const preview = {
        previewId: `catalog-import-${randomUUID()}`,
        actorId: actor.id ?? null,
        categoryId: evaluation.category.id,
        sourceMode: evaluation.sourceMode,
        catalogVersionId,
        providerSnapshotHash: sha256(context.providerOffers),
        families: evaluation.families,
        errors: evaluation.errors,
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + PREVIEW_TTL).toISOString(),
      };
      await savePreview(preview);
      return { previewId: preview.previewId, catalogVersionId, providerSnapshotHash: preview.providerSnapshotHash, category: { id: evaluation.category.id, name: evaluation.category.name, kind: evaluation.category.kind }, headers: evaluation.headers, familyCount: evaluation.families.length, rowCount: evaluation.rows.length, eligible: evaluation.rows.length - evaluation.errors.length, blocked: evaluation.errors.length, families: evaluation.families.map((family) => ({ family: family.family, productName: family.productName, variants: family.rows.length, coverageType: family.coverageType, coverageIds: family.coverageIds })), errors: evaluation.errors.slice(0, 100), expiresAt: preview.expiresAt };
    },

    execute(request, actor = {}) {
      requireObject(request, 'request');
      const previewId = requireNonEmptyString(request.previewId, 'previewId');
      return commandService.execute({
        operation: `CATALOG_IMPORT:${previewId}`, idempotencyKey: request.idempotencyKey, request,
        handler: async ({ commandId, requestHash }) => {
          if (request.confirm !== true) throw new CatalogWriteError('Cần xác nhận import.', { code: 'IMPORT_CONFIRM_REQUIRED' });
          const preview = await getPreview(previewId);
          const context = await readContext();
          assertCatalogBaseVersion(request.catalogVersionId, currentVersion(context.manifest));
          if (preview.catalogVersionId !== request.catalogVersionId || sha256(context.providerOffers) !== preview.providerSnapshotHash) throw new CatalogWriteError('Catalog hoặc provider snapshot đã thay đổi. Hãy preview lại.', { status: 409, code: 'IMPORT_PREVIEW_STALE' });
          if (preview.errors.length) throw new CatalogWriteError('Import còn dòng bị chặn.', { status: 409, code: 'IMPORT_BLOCKED', details: { errors: preview.errors.slice(0, 100) } });
          const timestamp = now().toISOString();
          const products = [...context.products];
          const variants = [...context.variants];
          const existingSlugs = new Set(products.map((product) => product.slug));
          for (const family of preview.families) {
            const productId = `product-${randomUUID()}`;
            let slug = slugify(family.productName);
            if (existingSlugs.has(slug)) slug = `${slug}-${sha256(`${family.family}:${productId}`).slice(0, 6)}`;
            existingSlugs.add(slug);
            products.push({ id: productId, slug, name: family.productName, operation: operationForCategoryKind(categoryById(context.categories, preview.categoryId).kind), categoryId: preview.categoryId, categoryNeedsReview: false, coverageType: family.coverageType, coverageIds: family.coverageIds, featured: false, status: 'draft', version: 1, createdAt: timestamp, updatedAt: timestamp });
            for (const row of family.rows) {
              const variantId = `variant-${randomUUID()}`;
              variants.push({ id: variantId, productId, sku: row.sku, publicSku: publicSkuForVariantId(variantId), dataLimit: row.dataLimit || undefined, duration: row.duration || undefined, price: row.price, compareAtPrice: row.compareAtPrice, currency: 'VND', ...row.fulfillment, ...(row.offer ? { providerOfferId: row.offer.id, wmproductId: row.offer.wmproductId, providerProductId: row.offer.providerProductId } : {}), stock: row.fulfillment.fulfillmentMethod === 'HICO_PHYSICAL_STOCK' ? 0 : null, active: false, archived: false, needsReview: row.fulfillment.fulfillmentMethod === 'MANUAL_PROCESSING', version: 1, createdAt: timestamp, updatedAt: timestamp });
            }
          }
          assertCanonicalCatalog({ products, variants, categories: context.categories, providerOffers: context.providerOffers });
          const versionId = `catalog-import-${Date.now()}-${randomUUID().slice(0, 8)}`;
          const audit = { id: `audit-${randomUUID()}`, actorId: actor.id, action: 'CATALOG_SHEET_IMPORT', entityType: 'catalog_import', entityId: previewId, changedFields: ['products', 'variants'], catalogVersionBefore: currentVersion(context.manifest), catalogVersionAfter: versionId, createdAt: timestamp };
          const committed = await commitService.commit({ versionId, parentVersionId: currentVersion(context.manifest), products, variants, categories: context.categories, providerOffers: context.providerOffers, commandType: 'CATALOG_SHEET_IMPORT', commandId, requestHash, createdAt: timestamp, beforePointer: () => auditRepository.append(audit), rollbackBeforePointer: () => auditRepository.remove(audit.id) });
          return { status: 201, catalogVersionId: committed.manifest.versionId, body: { previewId, productsCreated: preview.families.length, variantsCreated: preview.families.reduce((total, family) => total + family.rows.length, 0), catalogVersionId: committed.manifest.versionId, warnings: committed.warnings } };
        },
      });
    },
  };
};
