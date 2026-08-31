import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  collectMediaReferences,
  emptyMediaReport,
  loadMediaAuditContext,
  uploadsDirectory,
  walkImageValues,
} from './mediaAuditSupport.js';

const run = async () => {
  const report = emptyMediaReport();
  const context = await loadMediaAuditContext();
  const findings = walkImageValues(context.entities.map(({ value }) => value));
  const refs = collectMediaReferences(context.entities, context.assets);
  report.entitiesChecked = context.entities.length;
  report.mediaAssetsChecked = context.assets.length;
  report.rawImageUrlFields = findings.rawImageUrlFields;
  report.externalImageUrls = findings.externalImageUrls;
  report.dataUrls = findings.dataUrls;
  report.privateAssetsExposed = findings.privateAssetsExposed;
  report.missingAssets = refs.missingAssets;
  report.brokenReferences = refs.references.filter(({ asset }) => asset.status !== 'ACTIVE').map(({ source, path: referencePath }) => ({ source, path: referencePath, kind: 'archived-media-reference' }));
  report.orphanAssets = refs.orphanAssets;
  report.duplicateReferences = refs.duplicateReferences;
  try {
    const files = await readdir(uploadsDirectory, { withFileTypes: true });
    report.unsupportedMimeTypes = files
      .filter((entry) => entry.isFile() && /\.(?:bmp|tiff?|avif|svg)$/i.test(entry.name))
      .map((entry) => ({ path: entry.name, kind: path.extname(entry.name).toLowerCase() }));
  } catch { /* missing upload directory is an empty inventory */ }
  report.success = [report.externalImageUrls, report.dataUrls, report.missingAssets, report.brokenReferences, report.duplicateReferences, report.privateAssetsExposed, report.unsupportedMimeTypes].every((items) => items.length === 0);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.success ? 0 : 1;
};

run().catch((error) => {
  console.error(JSON.stringify({ ...emptyMediaReport(), error: 'MEDIA_VALIDATION_FAILED', detail: error.message }, null, 2));
  process.exitCode = 1;
});
