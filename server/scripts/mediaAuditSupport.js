import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanonicalCatalogRepository } from '../catalog/canonical/canonicalCatalogRepository.js';
import { createMediaAssetRepository } from '../media/mediaAssetRepository.js';

const IMAGE_FIELD_PATTERN = /(?:^|_)(?:image|images|thumbnail|cover|banner|avatar|logo|icon|gallery)(?:$|_)/i;
const IMAGE_EXTENSION_PATTERN = /\.(?:jpe?g|png|webp|gif|svg)$/i;
const PRIVATE_PATTERN = /(?:^|[/\\])(?:qr_|private_|support_)/i;

const workspaceUploads = path.join(process.cwd(), 'server', 'uploads');
export const uploadsDirectory = existsSync(workspaceUploads)
  ? workspaceUploads
  : path.join(process.cwd(), 'uploads');

export const readJson = async (filePath, fallback = null) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    return error?.code === 'ENOENT' ? fallback : fallback;
  }
};

const addFinding = (target, finding) => {
  if (target.length < 100) target.push(finding);
};

export const walkImageValues = (value, currentPath = '$', findings = {}) => {
  if (!findings.rawImageUrlFields) findings.rawImageUrlFields = [];
  if (!findings.externalImageUrls) findings.externalImageUrls = [];
  if (!findings.dataUrls) findings.dataUrls = [];
  if (!findings.privateAssetsExposed) findings.privateAssetsExposed = [];
  if (value === null || value === undefined) return findings;
  if (typeof value === 'string') {
    const isImageField = IMAGE_FIELD_PATTERN.test(currentPath) || IMAGE_EXTENSION_PATTERN.test(value) || value.startsWith('data:image/');
    if (!isImageField) return findings;
    const safe = { path: currentPath, kind: value.startsWith('/') ? 'legacy-local-url' : 'image-reference' };
    addFinding(findings.rawImageUrlFields, safe);
    if (value.startsWith('data:image/')) addFinding(findings.dataUrls, { path: currentPath, kind: 'data-url' });
    if (/^https?:\/\//i.test(value)) addFinding(findings.externalImageUrls, { path: currentPath, kind: 'external-url' });
    if (PRIVATE_PATTERN.test(value)) addFinding(findings.privateAssetsExposed, { path: currentPath, kind: 'private-path' });
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkImageValues(item, `${currentPath}.${index}`, findings));
    return findings;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => walkImageValues(item, `${currentPath}.${key}`, findings));
  }
  return findings;
};

const flattenEntities = (value, source, collection = []) => {
  if (Array.isArray(value)) value.forEach((item) => collection.push({ source, value: item }));
  else if (value && typeof value === 'object') collection.push({ source, value });
  return collection;
};

export const loadMediaAuditContext = async () => {
  const canonicalRepository = createCanonicalCatalogRepository({ uploadsDirectory });
  const mediaAssetRepository = createMediaAssetRepository({ uploadsDirectory });
  let catalog = { products: [], variants: [] };
  try { catalog = await canonicalRepository.readCatalog({ required: true }); } catch { /* report empty inventory safely */ }
  const legacyRows = [];
  for (const filename of ['destinations.json', 'packages.json', 'devices.json', 'articles.json', 'promos.json']) {
    const value = await readJson(path.join(uploadsDirectory, filename), []);
    flattenEntities(value, filename, legacyRows);
  }
  const entities = [
    ...flattenEntities(catalog.products, 'canonical-products'),
    ...flattenEntities(catalog.variants, 'canonical-variants'),
    ...legacyRows,
  ];
  const assets = await mediaAssetRepository.list({ status: '' });
  return { catalog, entities, assets, mediaAssetRepository };
};

export const collectMediaReferences = (entities, assets) => {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const byUrl = new Map(assets.map((asset) => [asset.publicUrl, asset]));
  const references = [];
  const missingAssets = [];
  const duplicateReferences = [];
  for (const { source, value } of entities) {
    const ids = [];
    const visit = (node, currentPath = '$') => {
      if (node === null || node === undefined) return;
      if (typeof node === 'string') {
        if (/^media_[a-zA-Z0-9_-]+$/.test(node)) ids.push({ id: node, path: currentPath });
        const asset = byUrl.get(node);
        if (asset) references.push({ asset, source, path: currentPath });
        return;
      }
      if (Array.isArray(node)) return node.forEach((item, index) => visit(item, `${currentPath}.${index}`));
      if (typeof node === 'object') Object.entries(node).forEach(([key, item]) => visit(item, `${currentPath}.${key}`));
    };
    visit(value);
    for (const ref of ids) {
      const asset = byId.get(ref.id);
      if (!asset) addFinding(missingAssets, { source, path: ref.path, kind: 'missing-media-id' });
      else references.push({ asset, source, path: ref.path });
    }
    for (const field of ['galleryMediaIds', 'gallery']) {
      const list = Array.isArray(value?.[field]) ? value[field] : [];
      const seen = new Set();
      list.forEach((item, index) => {
        const id = typeof item === 'string' ? item : item?.id;
        if (id && seen.has(id)) addFinding(duplicateReferences, { source, path: `$.${field}.${index}`, kind: 'duplicate-reference' });
        if (id) seen.add(id);
      });
    }
  }
  const referencedIds = new Set(references.map(({ asset }) => asset.id));
  return {
    references,
    missingAssets,
    duplicateReferences,
    orphanAssets: assets.filter((asset) => !referencedIds.has(asset.id)).map((asset) => ({ id: asset.id, kind: 'unreferenced-asset' })),
  };
};

export const emptyMediaReport = () => ({
  entitiesChecked: 0,
  mediaAssetsChecked: 0,
  rawImageUrlFields: [],
  externalImageUrls: [],
  dataUrls: [],
  missingAssets: [],
  brokenReferences: [],
  orphanAssets: [],
  duplicateReferences: [],
  privateAssetsExposed: [],
  unsupportedMimeTypes: [],
  success: false,
});
