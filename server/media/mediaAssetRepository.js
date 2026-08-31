import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const IMAGE_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);
const PRIVATE_PREFIXES = ['qr_', 'private_', 'support_'];

const now = () => new Date().toISOString();
const safeId = (value) => `media_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
const isPublicImageName = (name) => {
  const extension = path.extname(name).toLowerCase();
  return IMAGE_TYPES.has(extension) && !PRIVATE_PREFIXES.some((prefix) => name.startsWith(prefix));
};

const readJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
};

const writeJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
};

const normalizeAsset = (asset) => {
  if (!asset || typeof asset !== 'object' || typeof asset.publicUrl !== 'string') return null;
  const extension = typeof asset.extension === 'string' ? asset.extension : path.extname(asset.publicUrl);
  const mimeType = typeof asset.mimeType === 'string' ? asset.mimeType : IMAGE_TYPES.get(extension.toLowerCase());
  if (!mimeType || !/^image\/(?:jpeg|png|webp|gif)$/.test(mimeType)) return null;
  const id = typeof asset.id === 'string' && asset.id ? asset.id : safeId(asset.publicUrl);
  return {
    id,
    storagePath: typeof asset.storagePath === 'string' ? asset.storagePath : asset.publicUrl.replace(/^\//, ''),
    publicUrl: asset.publicUrl,
    originalName: typeof asset.originalName === 'string' ? asset.originalName : path.basename(asset.publicUrl),
    mimeType,
    extension: extension.startsWith('.') ? extension : `.${extension}`,
    size: Number.isInteger(asset.size) ? asset.size : 0,
    ...(Number.isInteger(asset.width) ? { width: asset.width } : {}),
    ...(Number.isInteger(asset.height) ? { height: asset.height } : {}),
    ...(typeof asset.altText === 'string' ? { altText: asset.altText.slice(0, 500) } : {}),
    ...(typeof asset.title === 'string' ? { title: asset.title.slice(0, 240) } : {}),
    status: asset.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    createdAt: typeof asset.createdAt === 'string' ? asset.createdAt : now(),
    updatedAt: typeof asset.updatedAt === 'string' ? asset.updatedAt : now(),
    ...(typeof asset.createdBy === 'string' ? { createdBy: asset.createdBy.slice(0, 160) } : {}),
  };
};

export const createMediaAssetRepository = ({ uploadsDirectory, referenceProvider = async () => [] } = {}) => {
  const assetsFile = path.join(uploadsDirectory, 'media_assets.json');

  const readPersisted = async () => {
    const rows = await readJson(assetsFile, []);
    return Array.isArray(rows) ? rows.map(normalizeAsset).filter(Boolean) : [];
  };

  const scanLegacy = async () => {
    let entries;
    try {
      entries = await readdir(uploadsDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
    const result = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.name === 'media_assets.json' || !isPublicImageName(entry.name)) continue;
      const filePath = path.join(uploadsDirectory, entry.name);
      const fileStat = await stat(filePath);
      const publicUrl = `/uploads/${entry.name}`;
      result.push(normalizeAsset({
        id: safeId(publicUrl),
        storagePath: entry.name,
        publicUrl,
        originalName: entry.name,
        mimeType: IMAGE_TYPES.get(path.extname(entry.name).toLowerCase()),
        extension: path.extname(entry.name).toLowerCase(),
        size: fileStat.size,
        status: 'ACTIVE',
        createdAt: fileStat.birthtime.toISOString(),
        updatedAt: fileStat.mtime.toISOString(),
      }));
    }
    return result.filter(Boolean);
  };

  const all = async () => {
    const [persisted, legacy] = await Promise.all([readPersisted(), scanLegacy()]);
    const byUrl = new Map(legacy.map((asset) => [asset.publicUrl, asset]));
    for (const asset of persisted) byUrl.set(asset.publicUrl, asset);
    return [...byUrl.values()];
  };

  return {
    async list({ search = '', mimeType, status = 'ACTIVE' } = {}) {
      const normalizedSearch = String(search).trim().toLocaleLowerCase('vi-VN');
      return (await all())
        .filter((asset) => !status || asset.status === status)
        .filter((asset) => !mimeType || asset.mimeType === mimeType)
        .filter((asset) => !normalizedSearch || `${asset.originalName} ${asset.title ?? ''} ${asset.altText ?? ''}`.toLocaleLowerCase('vi-VN').includes(normalizedSearch))
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    },

    async getById(id, { includeArchived = false } = {}) {
      const asset = (await all()).find((candidate) => candidate.id === id || candidate.publicUrl === id || path.basename(candidate.publicUrl) === id);
      if (!asset || (!includeArchived && asset.status !== 'ACTIVE')) return null;
      return asset;
    },

    async getByIds(ids, options) {
      const wanted = new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && id));
      return (await all()).filter((asset) => wanted.has(asset.id) && (options?.includeArchived || asset.status === 'ACTIVE'));
    },

    async createFromUpload({ upload, originalName = upload.filename, createdBy }) {
      const extension = upload.filename.slice(upload.filename.lastIndexOf('.')).toLowerCase();
      const mimeType = upload.type;
      if (!IMAGE_TYPES.has(extension) || IMAGE_TYPES.get(extension) !== mimeType) throw new Error('MEDIA_UNSUPPORTED_TYPE');
      const filePath = path.join(uploadsDirectory, upload.filename);
      await mkdir(uploadsDirectory, { recursive: true });
      await writeFile(filePath, upload.buffer, { flag: 'wx', mode: 0o640 });
      const timestamp = now();
      const asset = normalizeAsset({
        id: `media_${randomUUID().replaceAll('-', '')}`,
        storagePath: upload.filename,
        publicUrl: `/uploads/${upload.filename}`,
        originalName,
        mimeType,
        extension,
        size: upload.buffer.length,
        status: 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy,
      });
      const persisted = await readPersisted();
      await writeJson(assetsFile, [...persisted.filter((row) => row.id !== asset.id), asset]);
      return asset;
    },

    async update(id, changes = {}) {
      const asset = await this.getById(id, { includeArchived: true });
      if (!asset) return null;
      const persisted = await readPersisted();
      const updated = normalizeAsset({ ...asset, ...changes, id: asset.id, publicUrl: asset.publicUrl, updatedAt: now() });
      await writeJson(assetsFile, [...persisted.filter((row) => row.id !== asset.id), updated]);
      return updated;
    },

    async archiveOrDelete(id) {
      const asset = await this.getById(id, { includeArchived: true });
      if (!asset) return { status: 404, asset: null, references: [] };
      const references = await referenceProvider(asset);
      if (references.length > 0) return { status: 409, asset, references };
      const persisted = await readPersisted();
      const isLegacy = asset.id === safeId(asset.publicUrl);
      if (isLegacy) return { status: 409, asset, references: [{ source: 'legacy-media', path: asset.publicUrl }] };
      await rm(path.join(uploadsDirectory, path.basename(asset.storagePath)), { force: true });
      await writeJson(assetsFile, persisted.filter((row) => row.id !== asset.id));
      return { status: 200, asset, references: [] };
    },

    async referenceIds(ids) {
      const assets = await this.getByIds(ids, { includeArchived: true });
      return new Set(assets.map((asset) => asset.id));
    },
  };
};
