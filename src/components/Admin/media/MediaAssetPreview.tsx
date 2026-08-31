import type { MediaAsset } from '../../../types/media';

interface MediaAssetPreviewProps {
  asset?: MediaAsset | null;
  legacyUrl?: string;
  alt?: string;
  compact?: boolean;
}

export const MediaAssetPreview = ({ asset, legacyUrl, alt = '', compact = false }: MediaAssetPreviewProps) => {
  const url = asset?.publicUrl ?? legacyUrl;
  if (!url) return <div className={`admin-media-empty-preview${compact ? ' compact' : ''}`}>Chưa chọn ảnh</div>;
  return <div className={`admin-media-preview${compact ? ' compact' : ''}`}><img src={url} alt={asset?.altText || alt} /><span>{asset?.originalName ?? 'Ảnh legacy'}</span></div>;
};
