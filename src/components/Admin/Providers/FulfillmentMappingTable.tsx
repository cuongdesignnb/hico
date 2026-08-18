import { CheckCircle2, LoaderCircle, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fulfillmentAdminApi, FulfillmentAdminApiError } from '../../../services/fulfillmentAdminApi';
import type { FulfillmentPreviewItem } from '../../../types/fulfillment';
import { useAdminToast } from '../../../hooks/useAdminToast';

interface FulfillmentMappingTableProps {
  searchQuery: string;
}

const displayCode = (code: string) => code.replace(/^PROVIDER_/, '').replaceAll('_', ' ');

const FulfillmentMappingTable = ({ searchQuery }: FulfillmentMappingTableProps) => {
  const [items, setItems] = useState<FulfillmentPreviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [selectedOffers, setSelectedOffers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const toast = useAdminToast();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems((await fulfillmentAdminApi.preview()).items);
    } catch (loadError) {
      setError(loadError instanceof FulfillmentAdminApiError ? loadError.message : 'Unable to load fulfillment preview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fulfillmentAdminApi.preview()
      .then((payload) => { if (!cancelled) setItems(payload.items); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof FulfillmentAdminApiError ? loadError.message : 'Unable to load fulfillment preview.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('vi-VN');
    if (!query) return items;
    return items.filter((item) => `${item.productName} ${item.sku ?? ''} ${item.variantId} ${item.familyKey ?? ''}`.toLocaleLowerCase('vi-VN').includes(query));
  }, [items, searchQuery]);

  const approve = async (item: FulfillmentPreviewItem, providerOfferId: string) => {
    if (!providerOfferId || !window.confirm(`Persist mapping cho ${item.sku ?? item.variantId}?`)) return;
    setBusyKey(item.variantId);
    setError('');
    try {
      if (item.binding) await fulfillmentAdminApi.change(item.binding.id, { variantId: item.variantId, providerOfferId, version: item.binding.version, confirmed: true });
      else await fulfillmentAdminApi.approve({ variantId: item.variantId, providerOfferId, confirmed: true });
      toast.success(`Đã lưu mapping cho ${item.sku ?? item.variantId}.`);
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof FulfillmentAdminApiError ? saveError.message : 'Unable to save provider mapping.');
    } finally {
      setBusyKey('');
    }
  };

  const revoke = async (item: FulfillmentPreviewItem) => {
    if (!item.binding || !window.confirm(`Revoke mapping cho ${item.sku ?? item.variantId}?`)) return;
    setBusyKey(item.variantId);
    setError('');
    try {
      await fulfillmentAdminApi.revoke(item.binding.id, item.binding.version);
      toast.success(`Đã revoke mapping cho ${item.sku ?? item.variantId}.`);
      await load();
    } catch (revokeError) {
      toast.error(revokeError instanceof FulfillmentAdminApiError ? revokeError.message : 'Unable to revoke provider mapping.');
    } finally {
      setBusyKey('');
    }
  };

  if (loading) return <div className="provider-state" role="status"><LoaderCircle className="provider-loader" size={24} /><span>Loading fulfillment preview...</span></div>;

  return (
    <div className="fulfillment-mapping-panel">
      <div className="fulfillment-toolbar">
        <div><strong>Fulfillment binding preview</strong><span>Exact is automatic. Only a longer fallback can be persisted as an approved mapping.</span></div>
        <button className="reconciliation-secondary-button" type="button" onClick={() => void load()} disabled={Boolean(busyKey)}><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <p className="fulfillment-error" role="alert"><ShieldAlert size={15} /> {error}</p>}
      <div className="provider-table-scroll">
        <table className="provider-table fulfillment-table">
          <thead><tr><th>Product / SKU</th><th>Requested</th><th>Family / medium</th><th>Resolution</th><th>Provider offer</th><th>Action</th></tr></thead>
          <tbody>
            {visibleItems.map((item) => {
              const fallbackOffers = item.fallbackOffers.length > 0 ? item.fallbackOffers : (item.nextLongerOffer ? [item.nextLongerOffer] : []);
              const defaultOffer = item.binding ? item.providerOffer : fallbackOffers[0] ?? null;
              const selectedOfferId = selectedOffers[item.variantId] ?? defaultOffer?.id ?? '';
              const candidate = fallbackOffers.find((offer) => offer.id === selectedOfferId) ?? defaultOffer;
              const busy = busyKey === item.variantId;
              return <tr key={item.variantId}>
                <td className="reconciliation-product"><strong>{item.productName}</strong><span>{item.sku ?? item.variantId}</span></td>
                <td>{item.requestedDays ?? '-'}d{item.providerDays && item.providerDays !== item.requestedDays ? ` → ${item.providerDays}d` : ''}</td>
                <td><span>{item.medium ?? '-'}</span><small>{item.familyKey ?? 'Missing explicit family'}</small></td>
                <td><span className={`reconciliation-status ${item.strategy ? 'reconciliation-status-success' : 'reconciliation-status-warning'}`}>{item.strategy ?? displayCode(item.code)}</span><small>{item.margin?.status ?? 'MARGIN_UNKNOWN_CURRENCY'}</small>{item.warnings.length > 0 && <small className="fulfillment-warning"><ShieldAlert size={13} /> {item.warnings.join(', ')}</small>}</td>
                <td><strong>{candidate?.wmproductId ?? '-'}</strong><small>{candidate?.durationDays ? `${candidate.durationDays}d` : 'No eligible offer'}</small></td>
                <td><div className="fulfillment-actions">
                  {candidate && !item.exactOffer && <>
                    {fallbackOffers.length > 1 && <select value={selectedOfferId} onChange={(event) => setSelectedOffers((current) => ({ ...current, [item.variantId]: event.target.value }))} aria-label={`Provider fallback for ${item.sku ?? item.variantId}`}><option value="">Select offer</option>{fallbackOffers.map((offer) => <option value={offer.id} key={offer.id}>{offer.durationDays}d · {offer.wmproductId}</option>)}</select>}
                    <button className="reconciliation-primary-button" type="button" disabled={busy || !selectedOfferId} onClick={() => void approve(item, selectedOfferId)}>{busy ? <LoaderCircle className="provider-loader" size={14} /> : <CheckCircle2 size={14} />} {item.binding ? 'Change' : 'Approve'}</button>
                  </>}
                  {item.binding && <button className="reconciliation-secondary-button" type="button" disabled={busy} onClick={() => void revoke(item)}><XCircle size={14} /> Revoke</button>}
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {visibleItems.length === 0 && <div className="provider-state provider-empty"><strong>No fulfillment candidates</strong><span>There is no compatible provider evidence in the current catalog snapshot.</span></div>}
    </div>
  );
};

export default FulfillmentMappingTable;
