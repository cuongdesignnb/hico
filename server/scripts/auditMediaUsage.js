import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  collectMediaReferences,
  emptyMediaReport,
  loadMediaAuditContext,
  walkImageValues,
} from './mediaAuditSupport.js';

const sourceFiles = [
  'src/components/Admin/AdminDashboard.tsx',
  'src/components/Admin/RichTextEditor.tsx',
  'src/components/Admin/Catalog/ProductWizard/ProductGeneralStep.tsx',
  'src/components/Admin/media/MediaLibraryPicker.tsx',
  'src/components/Admin/media/MediaAssetField.tsx',
  'src/components/Admin/media/MediaGalleryField.tsx',
  'src/services/adminMediaApi.ts',
];

const run = async () => {
  const report = emptyMediaReport();
  const context = await loadMediaAuditContext();
  const findings = walkImageValues(context.entities.map(({ value }) => value));
  const refs = collectMediaReferences(context.entities, context.assets);
  const sourceChecks = [];
  for (const relativePath of sourceFiles) {
    const filePath = path.join(process.cwd(), relativePath);
    try {
      const source = await readFile(filePath, 'utf8');
      sourceChecks.push({ path: relativePath, bytes: Buffer.byteLength(source, 'utf8'), hasMediaPicker: source.includes('MediaAssetField') || source.includes('MediaLibraryPicker') || source.includes('adminMediaApi') });
    } catch {
      sourceChecks.push({ path: relativePath, bytes: 0, hasMediaPicker: false });
    }
  }
  Object.assign(report, {
    entitiesChecked: context.entities.length,
    mediaAssetsChecked: context.assets.length,
    rawImageUrlFields: findings.rawImageUrlFields,
    externalImageUrls: findings.externalImageUrls,
    dataUrls: findings.dataUrls,
    privateAssetsExposed: findings.privateAssetsExposed,
    missingAssets: refs.missingAssets,
    brokenReferences: refs.references.filter(({ asset }) => asset.status !== 'ACTIVE').map(({ source, path: referencePath }) => ({ source, path: referencePath, kind: 'archived-media-reference' })),
    orphanAssets: refs.orphanAssets,
    duplicateReferences: refs.duplicateReferences,
    sourceChecks,
  });
  report.success = report.missingAssets.length === 0 && report.brokenReferences.length === 0 && report.dataUrls.length === 0 && report.privateAssetsExposed.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.success ? 0 : 1;
};

run().catch((error) => {
  console.error(JSON.stringify({ ...emptyMediaReport(), error: 'MEDIA_AUDIT_FAILED', detail: error.message }, null, 2));
  process.exitCode = 1;
});
