import { Check, ImagePlus, LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { listAdminMedia, uploadAdminMedia } from '../../../services/adminMediaApi';
import type { MediaAsset } from '../../../types/media';
import './media.css';

interface MediaLibraryPickerProps {
  open: boolean;
  multiple?: boolean;
  selectedIds: string[];
  maxItems?: number;
  onSelect: (assets: MediaAsset[]) => void;
  onClose: () => void;
}

export const MediaLibraryPicker = ({ open, multiple = false, selectedIds, maxItems = 50, onSelect, onClose }: MediaLibraryPickerProps) => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [chosenIds, setChosenIds] = useState<string[]>(selectedIds);
  const [search, setSearch] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement as HTMLElement | null;
    // The picker is reopened with the field's latest selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChosenIds(selectedIds);
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus();
    };
  }, [open, onClose, selectedIds]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listAdminMedia({ search, mimeType }).then((result) => { if (active) setAssets(result); }).catch(() => { if (active) setAssets([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, search, mimeType]);

  if (!open) return null;
  const toggle = (asset: MediaAsset) => {
    if (!multiple) { onSelect([asset]); onClose(); return; }
    setChosenIds((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : current.length >= maxItems ? current : [...current, asset.id]);
  };
  const confirmSelection = () => onSelect(assets.filter((asset) => chosenIds.includes(asset.id)));
  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadAdminMedia(file);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      if (!multiple) { onSelect([asset]); onClose(); }
      else setChosenIds((current) => current.includes(asset.id) ? current : [...current, asset.id].slice(0, maxItems));
    } finally { setUploading(false); }
  };
  return createPortal(
    <div className="admin-media-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="admin-media-picker" role="dialog" aria-modal="true" aria-labelledby="admin-media-picker-title">
        <header className="admin-media-picker-header"><div><span className="admin-media-kicker">Media Library</span><h2 id="admin-media-picker-title">Chọn ảnh từ thư viện</h2></div><button type="button" className="admin-media-icon-button" ref={closeButtonRef} onClick={onClose} aria-label="Đóng"><X size={18} /></button></header>
        <div className="admin-media-picker-toolbar"><label className="admin-media-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên ảnh" /></label><select value={mimeType} onChange={(event) => setMimeType(event.target.value)} aria-label="Lọc loại ảnh"><option value="">Tất cả loại ảnh</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option><option value="image/gif">GIF</option></select><label className="admin-media-upload-button"><ImagePlus size={15} /> Tải ảnh mới<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleUpload} /></label></div>
        {uploading && <p className="admin-media-status"><LoaderCircle size={15} className="admin-media-spin" /> Đang tải ảnh lên Media Library...</p>}
        <div className="admin-media-picker-body">{loading ? <p className="admin-media-status">Đang tải thư viện...</p> : assets.length === 0 ? <p className="admin-media-status">Chưa có ảnh phù hợp.</p> : <div className="admin-media-grid">{assets.map((asset) => { const selected = chosenIds.includes(asset.id); return <button type="button" key={asset.id} className={`admin-media-card${selected ? ' selected' : ''}`} onClick={() => toggle(asset)}><img src={asset.publicUrl} alt={asset.altText || asset.originalName} /><span className="admin-media-card-name">{asset.title || asset.originalName}</span>{selected && <span className="admin-media-selected"><Check size={14} /></span>}</button>; })}</div>}</div>
        <footer className="admin-media-picker-footer"><span>{multiple ? `${chosenIds.length}/${maxItems} ảnh đã chọn` : 'Chọn một ảnh để tiếp tục'}</span><div><button type="button" className="admin-media-secondary-button" onClick={onClose}>Hủy</button>{multiple && <button type="button" className="admin-media-primary-button" onClick={confirmSelection}>Chọn ảnh</button>}</div></footer>
      </section>
    </div>,
    document.body,
  );
};
