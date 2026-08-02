import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getWorldmoveOffers,
  syncWorldmoveOffers,
} from '../../../services/providerApi';
import type {
  ProviderOffer,
  ProviderSyncResult,
} from '../../../types/provider';
import ProviderOfferDetails from './ProviderOfferDetails';
import ReconciliationQueue from './ReconciliationQueue';
import WorldmoveOfferTable from './WorldmoveOfferTable';
import WorldmoveSyncButton from './WorldmoveSyncButton';
import { formatProviderDate } from './providerLabels';
import './ProviderCatalogTab.css';

interface ProviderCatalogTabProps {
  searchQuery: string;
}

type OfferTypeFilter =
  | 'all'
  | 'worldmove_esim'
  | 'local_esim'
  | 'physical'
  | 'topup';

type OfferStatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 20;

const matchesOfferType = (
  offer: ProviderOffer,
  filter: OfferTypeFilter,
) => {
  if (filter === 'all') return true;
  if (filter === 'worldmove_esim') {
    return offer.providerProductType === 0 && offer.leSIM === true;
  }
  if (filter === 'local_esim') {
    return offer.providerProductType === 0 && offer.leSIM === false;
  }
  if (filter === 'physical') return offer.providerProductType === 1;
  return offer.providerProductType === 2;
};

const ProviderCatalogTab = ({
  searchQuery,
}: ProviderCatalogTabProps) => {
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncResult, setSyncResult] = useState<ProviderSyncResult | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<ProviderOffer | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<OfferTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<OfferStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'worldmove' | 'reconciliation'>(
    'worldmove',
  );

  useEffect(() => {
    const controller = new AbortController();

    getWorldmoveOffers(controller.signal)
      .then(setOffers)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải offer Worldmove.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const filteredOffers = useMemo(() => {
    const normalizedSearch = `${searchQuery} ${localSearch}`
      .trim()
      .toLocaleLowerCase('vi-VN');

    return offers.filter((offer) => {
      const matchesSearch = normalizedSearch === ''
        || offer.providerProductName.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
        || offer.productRegion.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
        || offer.wmproductId.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
        || offer.providerProductId?.toLocaleLowerCase('vi-VN').includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all'
        || offer.active === (statusFilter === 'active');

      return matchesSearch
        && matchesStatus
        && matchesOfferType(offer, typeFilter);
    });
  }, [localSearch, offers, searchQuery, statusFilter, typeFilter]);

  const lastSyncedAt = offers.reduce<string | null>((latest, offer) => (
    latest === null || offer.syncedAt > latest ? offer.syncedAt : latest
  ), null);
  const totalPages = Math.max(1, Math.ceil(filteredOffers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleOffers = filteredOffers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    setSyncResult(null);

    try {
      const result = await syncWorldmoveOffers();
      const nextOffers = await getWorldmoveOffers();
      setSyncResult(result);
      setOffers(nextOffers);
      setPage(1);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Không thể đồng bộ Worldmove.');
    } finally {
      setSyncing(false);
    }
  };

  const updateTypeFilter = (value: OfferTypeFilter) => {
    setTypeFilter(value);
    setPage(1);
  };

  const updateStatusFilter = (value: OfferStatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <section className="provider-catalog-tab">
      <div className="provider-heading-row">
        <div>
          <span className="provider-eyebrow">Nguồn hàng</span>
          <h2>
            {activeTab === 'worldmove'
              ? 'Danh mục Worldmove'
              : 'Reconciliation Catalog'}
          </h2>
          <p>
            {activeTab === 'worldmove'
              ? `${filteredOffers.length.toLocaleString('vi-VN')} offer phù hợp`
              : 'Exact-match theo wmproductId, chưa tác động checkout'}
          </p>
        </div>
        {activeTab === 'worldmove' && (
          <WorldmoveSyncButton syncing={syncing} onSync={() => void handleSync()} />
        )}
      </div>

      <div className="provider-tabs" role="tablist" aria-label="Nguồn cung cấp">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'worldmove'}
          className={activeTab === 'worldmove' ? 'provider-tab-active' : undefined}
          onClick={() => setActiveTab('worldmove')}
        >
          Worldmove
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reconciliation'}
          className={activeTab === 'reconciliation' ? 'provider-tab-active' : undefined}
          onClick={() => setActiveTab('reconciliation')}
        >
          Cần xác nhận
        </button>
      </div>

      {activeTab === 'worldmove' ? (
        <>
          <div className="provider-summary" aria-label="Tổng quan Worldmove">
        <div><span>Tổng offer</span><strong>{offers.length.toLocaleString('vi-VN')}</strong></div>
        <div>
          <span>Đang hoạt động</span>
          <strong>{offers.filter((offer) => offer.active).length.toLocaleString('vi-VN')}</strong>
        </div>
        <div>
          <span>Ngừng cung cấp</span>
          <strong>{offers.filter((offer) => !offer.active).length.toLocaleString('vi-VN')}</strong>
        </div>
        <div>
          <span>Lần đồng bộ cuối</span>
          <strong>{lastSyncedAt ? formatProviderDate(lastSyncedAt) : 'Chưa đồng bộ'}</strong>
        </div>
      </div>

      {syncResult && (
        <div className="provider-sync-result" role="status">
          <strong>Đồng bộ thành công</strong>
          <span>
            {syncResult.created} mới, {syncResult.updated} cập nhật,{' '}
            {syncResult.unchanged} không đổi, {syncResult.deactivated} ngừng cung cấp
          </span>
        </div>
      )}

      {error && (
        <div className="provider-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="provider-filters">
        <label className="provider-search">
          <span>Tìm kiếm</span>
          <div>
            <Search size={15} />
            <input
              type="search"
              value={localSearch}
              onChange={(event) => {
                setLocalSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tên offer, vùng phủ, wmproductId"
            />
          </div>
        </label>
        <label>
          <span>Loại offer</span>
          <select
            value={typeFilter}
            onChange={(event) => updateTypeFilter(event.target.value as OfferTypeFilter)}
          >
            <option value="all">Tất cả</option>
            <option value="worldmove_esim">eSIM Worldmove</option>
            <option value="local_esim">eSIM nhà mạng địa phương</option>
            <option value="physical">SIM vật lý</option>
            <option value="topup">Top-up</option>
          </select>
        </label>
        <label>
          <span>Trạng thái</span>
          <select
            value={statusFilter}
            onChange={(event) => updateStatusFilter(event.target.value as OfferStatusFilter)}
          >
            <option value="all">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Ngừng cung cấp</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="provider-state" role="status">
          <LoaderCircle className="provider-loader" size={24} />
          <span>Đang tải offer Worldmove...</span>
        </div>
      ) : visibleOffers.length > 0 ? (
        <>
          <WorldmoveOfferTable
            offers={visibleOffers}
            onSelectOffer={setSelectedOffer}
          />
          <div className="provider-pagination">
            <span>Trang {currentPage} / {totalPages}</span>
            <div>
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage === 1}
                aria-label="Trang trước"
                title="Trang trước"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={currentPage === totalPages}
                aria-label="Trang sau"
                title="Trang sau"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="provider-state provider-empty">
          <strong>Chưa có offer phù hợp</strong>
          <span>Đồng bộ Worldmove hoặc thay đổi bộ lọc.</span>
        </div>
      )}

          {selectedOffer && (
            <ProviderOfferDetails
              offer={selectedOffer}
              onClose={() => setSelectedOffer(null)}
            />
          )}
        </>
      ) : (
        <ReconciliationQueue />
      )}
    </section>
  );
};

export default ProviderCatalogTab;
