import { Images, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listAdminMedia } from '../../../services/adminMediaApi';
import type { MediaAsset } from '../../../types/media';
import { MediaAssetPreview } from './MediaAssetPreview';
import { MediaLibraryPicker } from './MediaLibraryPicker';

interface MediaAssetFieldProps {
  value: string | null;
  onChange: (mediaId: string | null) => void;
  label: string;
  required?: boolean;
  allowedMimeTypes?: string[];
  disabled?: boolean;
  legacyUrl?: string;
}

export const MediaAssetField = ({ value, onChange, label, required = false, disabled = false, legacyUrl }: MediaAssetFieldProps) => {
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  useEffect(() => { if (!value) return undefined; let active = true; listAdminMedia().then((items) => { if (active) setAsset(items.find((item) => item.id === value) ?? null); }).catch(() => { if (active) setAsset(null); }); return () => { active = false; }; }, [value]);
  return <div className="admin-media-field"><div className="admin-media-field-label"><span>{label}{required && <b> *</b>}</span><div><button type="button" className="admin-media-select-button" disabled={disabled} onClick={() => setOpen(true)}><Images size={15} /> {value ? 'Thay đổi' : 'Chọn từ thư viện'}</button>{value && <button type="button" className="admin-media-remove-button" disabled={disabled} onClick={() => { setAsset(null); onChange(null); }} title="Bỏ ảnh khỏi đối tượng"><Trash2 size={15} /></button>}</div></div><MediaAssetPreview asset={value ? asset : null} legacyUrl={!value ? legacyUrl : undefined} /><MediaLibraryPicker open={open} selectedIds={value ? [value] : []} onSelect={(items) => { const next = items[0]; setAsset(next ?? null); onChange(next?.id ?? null); }} onClose={() => setOpen(false)} /></div>;
};
