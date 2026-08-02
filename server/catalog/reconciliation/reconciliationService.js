import { createCatalogService } from '../catalogService.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createReconciliationRepository } from './reconciliationRepository.js';
import {
  reconcileCatalogVariant,
  snapshotProviderOffer,
  validateResolutionForContext,
} from './reconciliationRules.js';
import { summarizeReconciliation } from './reconciliationSummary.js';
import {
  isReconciliationResolution,
} from './reconciliationValidation.js';

export class ReconciliationRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReconciliationRequestError';
  }
}

export class ReconciliationNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReconciliationNotFoundError';
  }
}

const indexOffersByWorldmoveId = (offers) => {
  const offersByWorldmoveId = new Map();

  for (const offer of offers) {
    const matchingOffers = offersByWorldmoveId.get(offer.wmproductId) ?? [];
    matchingOffers.push(offer);
    offersByWorldmoveId.set(offer.wmproductId, matchingOffers);
  }

  return offersByWorldmoveId;
};

const flattenCatalog = (products) => products.flatMap(
  (product) => (product.variants ?? []).map((variant) => ({ product, variant })),
);

const withoutTimestamps = (record) => {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...comparable } = record;
  return comparable;
};

const recordsEqual = (left, right) => (
  JSON.stringify(withoutTimestamps(left)) === JSON.stringify(withoutTimestamps(right))
);

const preserveAdminDecision = ({
  existing,
  evaluated,
  matchingOffers,
  now,
}) => {
  const selectedOffer = existing.providerOfferId
    ? matchingOffers.find((offer) => offer.id === existing.providerOfferId)
    : undefined;
  const providerDrift = Boolean(
    existing.providerOfferId
    && (
      !selectedOffer
      || snapshotProviderOffer(selectedOffer) !== existing.providerSnapshotHash
    )
  );
  const catalogChanged = (
    existing.productId !== evaluated.productId
    || existing.sku !== evaluated.sku
    || existing.wmproductId !== evaluated.wmproductId
  );

  if (!providerDrift && !catalogChanged) {
    return existing;
  }

  const adminDecision = existing.status === 'IGNORED_BY_ADMIN'
    ? 'quyết định tạm bỏ qua'
    : 'xác nhận Admin';
  const reason = providerDrift
    ? `Đã giữ ${adminDecision}. Cảnh báo provider drift: ${evaluated.reason}`
    : `Đã giữ ${adminDecision} sau khi metadata catalog thay đổi.`;

  return {
    ...existing,
    productId: evaluated.productId,
    sku: evaluated.sku,
    ...(evaluated.wmproductId
      ? { wmproductId: evaluated.wmproductId }
      : { wmproductId: undefined }),
    reason,
    updatedAt: now,
  };
};

const providerOfferDto = (offer) => ({
  id: offer.id,
  wmproductId: offer.wmproductId,
  providerProductId: offer.providerProductId,
  providerProductName: offer.providerProductName,
  productRegion: offer.productRegion,
  providerProductType: offer.providerProductType,
  leSIM: offer.leSIM,
  active: offer.active,
  providerCost: offer.providerCost,
  providerCurrency: offer.providerCurrency,
  syncedAt: offer.syncedAt,
});

const normalizePageNumber = (value, fallback, maximum) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ReconciliationRequestError('Tham số phân trang không hợp lệ.');
  }
  return Math.min(parsed, maximum);
};

const normalizeBooleanFilter = (value) => {
  if (value === undefined || value === '') return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  throw new ReconciliationRequestError('Bộ lọc leSIM không hợp lệ.');
};

export const createReconciliationService = ({
  catalogService = createCatalogService(),
  providerRepository = createProviderOfferRepository(),
  reconciliationRepository = createReconciliationRepository(),
  now = () => new Date(),
} = {}) => {
  const readContext = async () => {
    const [products, offers, records] = await Promise.all([
      catalogService.listAdminProducts(),
      providerRepository.listOffers(),
      reconciliationRepository.listRecords(),
    ]);

    return {
      products,
      offers,
      records,
      catalogItems: flattenCatalog(products),
      offersByWorldmoveId: indexOffersByWorldmoveId(offers),
    };
  };

  return {
    async run() {
      const {
        records,
        catalogItems,
        offersByWorldmoveId,
      } = await readContext();
      const runAt = now().toISOString();
      const existingByVariantId = new Map(
        records.map((record) => [record.variantId, record]),
      );

      let created = 0;
      let updated = 0;
      let unchanged = 0;
      let adminConfirmedPreserved = 0;

      const nextRecords = catalogItems.map(({ product, variant }) => {
        const matchingOffers = variant.wmproductId
          ? offersByWorldmoveId.get(variant.wmproductId) ?? []
          : [];
        const evaluated = reconcileCatalogVariant({
          product,
          variant,
          matchingOffers,
          now: runAt,
        });
        const existing = existingByVariantId.get(variant.id);

        if (!existing) {
          created += 1;
          return evaluated;
        }

        if (
          existing.status === 'CONFIRMED_BY_ADMIN'
          || existing.status === 'IGNORED_BY_ADMIN'
        ) {
          if (existing.status === 'CONFIRMED_BY_ADMIN') {
            adminConfirmedPreserved += 1;
          }
          const preserved = preserveAdminDecision({
            existing,
            evaluated,
            matchingOffers,
            now: runAt,
          });
          if (preserved === existing) unchanged += 1;
          else updated += 1;
          return preserved;
        }

        const nextRecord = {
          ...evaluated,
          createdAt: existing.createdAt,
        };

        if (recordsEqual(existing, nextRecord)) {
          unchanged += 1;
          return existing;
        }

        updated += 1;
        return nextRecord;
      });

      if (records.length > nextRecords.length) {
        updated += records.length - nextRecords.length;
      }

      if (created > 0 || updated > 0) {
        await reconciliationRepository.saveRecords(nextRecords);
      }

      return {
        created,
        updated,
        unchanged,
        adminConfirmedPreserved,
        summary: summarizeReconciliation(nextRecords),
      };
    },

    async getSummary() {
      return summarizeReconciliation(
        await reconciliationRepository.listRecords(),
      );
    },

    async listItems(query = {}) {
      const {
        products,
        records,
        catalogItems,
        offersByWorldmoveId,
      } = await readContext();
      const productById = new Map(products.map((product) => [product.id, product]));
      const variantById = new Map(
        catalogItems.map(({ variant }) => [variant.id, variant]),
      );
      const normalizedSearch = String(query.search ?? '')
        .trim()
        .toLocaleLowerCase('vi-VN');
      const leSIMFilter = normalizeBooleanFilter(query.leSIM);
      const providerProductTypeFilter = query.providerProductType === undefined
        || query.providerProductType === ''
        ? undefined
        : Number.parseInt(query.providerProductType, 10);

      if (
        providerProductTypeFilter !== undefined
        && ![0, 1, 2].includes(providerProductTypeFilter)
      ) {
        throw new ReconciliationRequestError(
          'Bộ lọc providerProductType không hợp lệ.',
        );
      }

      const enriched = records.map((record) => {
        const product = productById.get(record.productId);
        const variant = variantById.get(record.variantId);
        const matchingOffers = record.wmproductId
          ? offersByWorldmoveId.get(record.wmproductId) ?? []
          : [];

        return {
          ...record,
          productName: product?.name ?? record.productId,
          productOperation: product?.operation,
          variantMedium: variant?.medium,
          providerOffers: matchingOffers.map(providerOfferDto),
        };
      });

      const filtered = enriched.filter((item) => {
        const matches = (value, queryValue) => (
          queryValue === undefined
          || queryValue === ''
          || value === queryValue
        );
        const offerMatches = item.providerOffers.some((offer) => (
          (providerProductTypeFilter === undefined
            || offer.providerProductType === providerProductTypeFilter)
          && (leSIMFilter === undefined || offer.leSIM === leSIMFilter)
        ));
        const matchesProviderFilters = (
          providerProductTypeFilter === undefined && leSIMFilter === undefined
        ) || offerMatches;
        const searchText = [
          item.productName,
          item.productId,
          item.variantId,
          item.sku,
          item.wmproductId,
          item.providerOfferId,
          ...item.providerOffers.map((offer) => offer.providerProductName),
        ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN');

        return matches(item.status, query.status)
          && matches(item.productId, query.productId)
          && matches(item.variantId, query.variantId)
          && matches(item.wmproductId, query.wmproductId)
          && matches(item.providerOfferId, query.providerOfferId)
          && matchesProviderFilters
          && (normalizedSearch === '' || searchText.includes(normalizedSearch));
      });

      const pageSize = normalizePageNumber(query.pageSize, 20, 100);
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const page = Math.min(
        normalizePageNumber(query.page, 1, Number.MAX_SAFE_INTEGER),
        totalPages,
      );
      const start = (page - 1) * pageSize;

      return {
        items: filtered.slice(start, start + pageSize),
        page,
        pageSize,
        total: filtered.length,
        totalPages,
      };
    },

    async updateItem(variantId, {
      resolution,
      providerOfferId,
      action,
      reviewedBy = 'admin@hico.vn',
    } = {}) {
      const {
        records,
        catalogItems,
        offersByWorldmoveId,
      } = await readContext();
      const recordIndex = records.findIndex(
        (record) => record.variantId === variantId,
      );

      if (recordIndex === -1) {
        throw new ReconciliationNotFoundError(
          'Không tìm thấy reconciliation record.',
        );
      }

      if (typeof reviewedBy !== 'string' || reviewedBy.trim() === '') {
        throw new ReconciliationRequestError('Người xác nhận không hợp lệ.');
      }

      const catalogItem = catalogItems.find(
        ({ variant }) => variant.id === variantId,
      );
      if (!catalogItem) {
        throw new ReconciliationNotFoundError(
          'Không tìm thấy variant trong catalog.',
        );
      }

      const current = records[recordIndex];
      const reviewedAt = now().toISOString();

      if (action === 'IGNORE') {
        const ignored = {
          ...current,
          status: 'IGNORED_BY_ADMIN',
          reason: 'Admin đã bỏ qua tạm thời record này.',
          reviewedBy: reviewedBy.trim(),
          reviewedAt,
          updatedAt: reviewedAt,
        };
        delete ignored.confirmedResolution;
        const nextRecords = records.with(recordIndex, ignored);
        await reconciliationRepository.saveRecords(nextRecords);
        return ignored;
      }

      if (!isReconciliationResolution(resolution)) {
        throw new ReconciliationRequestError('Resolution không hợp lệ.');
      }

      const matchingOffers = current.wmproductId
        ? offersByWorldmoveId.get(current.wmproductId) ?? []
        : [];
      let selectedOffer;

      if (providerOfferId) {
        selectedOffer = matchingOffers.find((offer) => offer.id === providerOfferId);
        if (!selectedOffer) {
          throw new ReconciliationRequestError(
            'Offer đã chọn không khớp chính xác wmproductId của variant.',
          );
        }
      } else if (matchingOffers.length === 1) {
        [selectedOffer] = matchingOffers;
      } else if (resolution.startsWith('WORLDMOVE_')) {
        throw new ReconciliationRequestError(
          'Cần chọn rõ một offer Worldmove để xác nhận.',
        );
      }

      try {
        validateResolutionForContext({
          resolution,
          product: catalogItem.product,
          variant: catalogItem.variant,
          offer: selectedOffer,
        });
      } catch (error) {
        throw new ReconciliationRequestError(error.message);
      }

      const confirmed = {
        ...current,
        ...(selectedOffer ? { providerOfferId: selectedOffer.id } : {}),
        status: 'CONFIRMED_BY_ADMIN',
        confirmedResolution: resolution,
        reason: 'Admin đã xác nhận resolution; checkout chưa thay đổi hành vi.',
        reviewedBy: reviewedBy.trim(),
        reviewedAt,
        ...(selectedOffer
          ? { providerSnapshotHash: snapshotProviderOffer(selectedOffer) }
          : {}),
        updatedAt: reviewedAt,
      };
      const nextRecords = records.with(recordIndex, confirmed);
      await reconciliationRepository.saveRecords(nextRecords);
      return confirmed;
    },
  };
};
