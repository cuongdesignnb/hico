import { Images, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listAdminMedia } from '../../../services/adminMediaApi';
import type { MediaAsset } from '../../../types/media';
import { MediaLibraryPicker } from './MediaLibraryPicker';

interface MediaGalleryFieldProps {
  value: string[];
  onChange: (mediaIds: string[]) => void;
  maxItems?: number;
  allowReorder?: boolean;
  label?: string;
  legacyUrls?: string[];
}

export const MediaGalleryField = ({ value, onChange, maxItems = 50, allowReorder = true, label = 'Thư viện ảnh', legacyUrls = [] }: MediaGalleryFieldProps) => {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  useEffect(() => { let active = true; listAdminMedia().then((items) => { if (active) setAssets(items.filter((item) => value.includes(item.id))); }).catch(() => setAssets([])); return () => { active = false; }; }, [value]);
  const move = (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= value.length) return; const next = [...value]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; onChange(next); };
  return <div className="admin-media-field"><div className="admin-media-field-label"><span>{label}</span><button type="button" className="admin-media-select-button" onClick={() => setOpen(true)}><Images size={15} /> Chọn nhiều ảnh</button></div><div className="admin-media-gallery-list">{value.map((id, index) => { const asset = assets.find((item) => item.id === id); return <div className="admin-media-gallery-item" key={id}><img src={asset?.publicUrl} alt={asset?.altText || asset?.originalName || ''} /><span>{asset?.title || asset?.originalName || id}</span>{allowReorder && <><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Đưa ảnh lên">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === value.length - 1} aria-label="Đưa ảnh xuống">↓</button></>}<button type="button" onClick={() => onChange(value.filter((item) => item !== id))} aria-label="Bỏ ảnh"><Trash2 size={14} /></button></div>; })}{value.length === 0 && legacyUrls.map((url) => <div className="admin-media-gallery-item legacy" key={url}><img src={url} alt="" /><span>Ảnh legacy, chọn lại để chuẩn hóa</span></div>)}{value.length === 0 && legacyUrls.length === 0 && <p className="admin-media-empty-inline">Chưa chọn ảnh.</p>}</div><MediaLibraryPicker open={open} multiple selectedIds={value} maxItems={maxItems} onSelect={(items) => onChange([...new Set(items.map((item) => item.id))])} onClose={() => setOpen(false)} /></div>;
};
