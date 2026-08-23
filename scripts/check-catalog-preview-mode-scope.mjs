import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const checks = [
  ['typed mode labels and full-job guard', 'src/types/catalogPreviewJob.ts', [
    'CATALOG_PREVIEW_MODE_LABELS',
    'isFullCatalogPreviewJob',
    "job?.mode === 'full'",
  ]],
  ['Full UI scopes reconnect and 409 by mode', 'src/components/Admin/Catalog/CatalogLifecycleControls.tsx', [
    'isFullCatalogPreviewJob(activeResult.value.job)',
    'isFullCatalogPreviewJob(activeResult.job)',
    'conflictingPreview',
    "fullBatch?.mode === 'full'",
    'CATALOG_PREVIEW_IN_PROGRESS',
  ]],
  ['Full UI keeps terminal result and guarded Apply', 'src/components/Admin/Catalog/CatalogLifecycleControls.tsx', [
    'previewTerminal',
    "fullJob?.status === 'SUCCEEDED'",
    'Xem kết quả Preview',
    'canApply',
  ]],
  ['Sheet Sync reconnects only Sheet modes', 'src/components/Admin/CatalogSheetSync/CatalogSheetSync.tsx', [
    'getActivePreviewJob',
    "activeJob.mode === 'full'",
    'conflictingJob',
    'CATALOG_PREVIEW_MODE_LABELS',
    'CATALOG_PREVIEW_IN_PROGRESS',
  ]],
  ['Settings reconnects legacy and blocks conflicting modes', 'src/components/Admin/Settings/Integrations/GoogleSheetSettings.tsx', [
    'getActivePreviewJob',
    "job.mode === 'legacy'",
    'conflictingJob',
    'CATALOG_PREVIEW_IN_PROGRESS',
    'Boolean(conflictingJob)',
  ]],
];

const failures = [];
for (const [name, relativePath, required] of checks) {
  const source = await read(relativePath);
  const missing = required.filter((needle) => !source.includes(needle));
  if (missing.length) failures.push({ name, file: relativePath, missing });
}

const result = { success: failures.length === 0, checks: checks.length, failures };
process.stdout.write(`${JSON.stringify(result)}\n`);
if (failures.length) process.exitCode = 1;
