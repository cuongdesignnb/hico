import { CheckCircle2, Edit3, LoaderCircle, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fulfillmentProfileAdminApi, FulfillmentProfileAdminApiError, type FulfillmentProfileInput } from '../../../services/fulfillmentProfileAdminApi';
import type { FulfillmentProfile, FulfillmentProfilePreviewItem } from '../../../types/fulfillmentProfile';
import { useAdminToast } from '../../../hooks/useAdminToast';

interface FulfillmentFamilyProfileProps {
  searchQuery: string;
}

const emptyForm = (item?: FulfillmentProfilePreviewItem): FulfillmentProfileInput => ({
  variantId: item?.variantId ?? 'var-1032',
  provider: 'WORLDMOVE',
  regionCode: 'CN',
  medium: 'ESIM',
  dataPolicy: 'DAILY_QUOTA:500:MB:DAY',
  speedPolicy: 'THROTTLE_KBPS:128:AFTER_QUOTA',
  networkPolicy: 'CN_TELECOM+CN_UNICOM',
  activationPolicy: '',
  resetPolicy: '',
  operationType: 'DATA_ONLY',
  durationDays: item?.durationDays ?? 1,
  source: 'ADMIN_APPROVED_BACKFILL',
  confirmed: true,
});

const FulfillmentFamilyProfile = ({ searchQuery }: FulfillmentFamilyProfileProps) => {
  const [items, setItems] = useState<FulfillmentProfilePreviewItem[]>([]);
  const [form, setForm] = useState<FulfillmentProfileInput>(emptyForm());
  const [editing, setEditing] = useState<FulfillmentProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useAdminToast();

  const load = async () => {
    setError('');
    try { setItems((await fulfillmentProfileAdminApi.preview()).items); } catch (loadError) { setError(loadError instanceof FulfillmentProfileAdminApiError ? loadError.message : 'Unable to load fulfillment profiles.'); }
  };

  useEffect(() => {
    let cancelled = false;
    fulfillmentProfileAdminApi.preview()
      .then((payload) => { if (!cancelled) setItems(payload.items); })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof FulfillmentProfileAdminApiError ? loadError.message : 'Unable to load fulfillment profiles.'); });
    return () => { cancelled = true; };
  }, []);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('vi-VN');
    return items.filter((item) => item.activeProfile || item.variantId === 'var-1032' || item.variantId === 'var-1033')
      .filter((item) => !query || `${item.variantId} ${item.sku ?? ''} ${item.activeProfile?.familyKey ?? ''}`.toLocaleLowerCase('vi-VN').includes(query));
  }, [items, searchQuery]);

  const startEdit = (profile: FulfillmentProfile) => {
    setEditing(profile);
    setForm({ variantId: profile.variantId, provider: profile.provider, regionCode: profile.regionCode, medium: profile.medium, dataPolicy: profile.dataPolicy, speedPolicy: profile.speedPolicy, networkPolicy: profile.networkPolicy ?? '', activationPolicy: profile.activationPolicy ?? '', resetPolicy: profile.resetPolicy ?? '', operationType: profile.operationType, durationDays: profile.durationDays, source: profile.source, confirmed: true, version: profile.version });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm(`Approve fulfillment family profile cho ${form.variantId}?`)) return;
    setBusy(true); setError('');
    try {
      if (editing) await fulfillmentProfileAdminApi.update(editing.id, form);
      else await fulfillmentProfileAdminApi.approve(form);
      toast.success('Fulfillment family profile đã được lưu sau khi Admin xác nhận.');
      setEditing(null); setForm(emptyForm()); await load();
    } catch (saveError) { toast.error(saveError instanceof FulfillmentProfileAdminApiError ? saveError.message : 'Unable to save fulfillment profile.'); } finally { setBusy(false); }
  };

  const revoke = async (profile: FulfillmentProfile) => {
    if (!window.confirm(`Revoke fulfillment profile cho ${profile.variantId}?`)) return;
    setBusy(true); setError('');
    try { await fulfillmentProfileAdminApi.revoke(profile.id, profile.version); toast.success('Profile đã được revoke.'); await load(); } catch (revokeError) { toast.error(revokeError instanceof FulfillmentProfileAdminApiError ? revokeError.message : 'Unable to revoke fulfillment profile.'); } finally { setBusy(false); }
  };

  const update = <K extends keyof FulfillmentProfileInput>(key: K, value: FulfillmentProfileInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  return <section className="fulfillment-family-profile" aria-label="Fulfillment Family Profile" style={{ marginBottom: 24, padding: 16, border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
      <div><strong>Fulfillment Family Profile</strong><p style={{ margin: '5px 0 0', color: '#6B7280', fontSize: 12 }}>Structured provider eligibility; duration nằm ngoài family key. Mọi thay đổi cần Admin xác nhận.</p></div>
      <button className="reconciliation-secondary-button" type="button" onClick={() => void load()} disabled={busy}><RotateCcw size={14} /> Refresh</button>
    </div>
    {error && <p className="fulfillment-error" role="alert"><ShieldAlert size={15} /> {error}</p>}
    <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
      <label>Variant ID<select value={form.variantId} onChange={(event) => { const selected = items.find((item) => item.variantId === event.target.value); update('variantId', event.target.value); if (!editing && selected?.durationDays) update('durationDays', selected.durationDays); }}><option value="var-1032">var-1032</option><option value="var-1033">var-1033</option></select></label>
      <label>Region<input value={form.regionCode} onChange={(event) => update('regionCode', event.target.value)} required /></label>
      <label>Medium<select value={form.medium} onChange={(event) => update('medium', event.target.value as FulfillmentProfileInput['medium'])}><option value="ESIM">ESIM</option><option value="PHYSICAL_SIM">PHYSICAL_SIM</option></select></label>
      <label>Data policy<input value={form.dataPolicy} onChange={(event) => update('dataPolicy', event.target.value)} required /></label>
      <label>Speed policy<input value={form.speedPolicy} onChange={(event) => update('speedPolicy', event.target.value)} required /></label>
      <label>Network policy<input value={form.networkPolicy} onChange={(event) => update('networkPolicy', event.target.value)} /></label>
      <label>Activation policy<input value={form.activationPolicy} onChange={(event) => update('activationPolicy', event.target.value)} /></label>
      <label>Reset policy<input value={form.resetPolicy} onChange={(event) => update('resetPolicy', event.target.value)} /></label>
      <label>Operation type<input value={form.operationType} onChange={(event) => update('operationType', event.target.value)} required /></label>
      <label>Duration<input type="number" min="1" value={form.durationDays} onChange={(event) => update('durationDays', Number(event.target.value))} required /></label>
      <label>Evidence source<input value={form.source} onChange={(event) => update('source', event.target.value)} required /></label>
      <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}><button className="reconciliation-primary-button" type="submit" disabled={busy}>{busy ? <LoaderCircle className="provider-loader" size={14} /> : <CheckCircle2 size={14} />} {editing ? 'Save' : 'Approve'}</button>{editing && <button className="reconciliation-secondary-button" type="button" onClick={() => { setEditing(null); setForm(emptyForm()); }}>Cancel</button>}</div>
    </form>
    <div className="provider-table-scroll"><table className="provider-table"><thead><tr><th>Variant / SKU</th><th>Family</th><th>Duration</th><th>Evidence</th><th>Action</th></tr></thead><tbody>{visibleItems.map((item) => <tr key={item.variantId}><td><strong>{item.variantId}</strong><small>{item.sku ?? '-'}</small></td><td><small>{item.activeProfile?.familyKey ?? 'FAMILY_PROFILE_NOT_FOUND'}</small></td><td>{item.activeProfile?.durationDays ?? item.durationDays ?? '-'}d</td><td>{item.activeProfile?.source ?? '-'}</td><td>{item.activeProfile && <div style={{ display: 'flex', gap: 6 }}><button className="reconciliation-secondary-button" type="button" onClick={() => startEdit(item.activeProfile!)} disabled={busy}><Edit3 size={14} /> Edit</button><button className="reconciliation-secondary-button" type="button" onClick={() => void revoke(item.activeProfile!)} disabled={busy}><XCircle size={14} /> Revoke</button></div>}</td></tr>)}</tbody></table></div>
  </section>;
};

export default FulfillmentFamilyProfile;
