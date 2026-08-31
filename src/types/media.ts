export type MediaAssetStatus = 'ACTIVE' | 'ARCHIVED';

export interface MediaAsset {
  id: string;
  storagePath: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  width?: number;
  height?: number;
  altText?: string;
  title?: string;
  status: MediaAssetStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  filename?: string;
  url?: string;
  date?: string;
}
