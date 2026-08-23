import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await fs.readFile(path.join(root, 'src/types/catalogPreviewJob.ts'), 'utf8');
const lifecycleSource = await fs.readFile(path.join(root, 'src/components/Admin/Catalog/CatalogLifecycleControls.tsx'), 'utf8');
const expected = [
  'STARTING',
  'READING_SHEET',
  'LOADING_CATALOG',
  'LOADING_PROVIDER',
  'PARSING',
  'BUILDING_CANDIDATE',
  'VALIDATING',
  'PERSISTING',
  'COMPLETED',
];

const quotedValues = (value) => [...value.matchAll(/'([^']+)'/g)].map((match) => match[1]);
const capture = (pattern, description) => {
  const match = source.match(pattern);
  if (!match) throw new Error(`Không đọc được ${description} từ catalogPreviewJob.ts`);
  return match[1];
};
const union = quotedValues(capture(/export type CatalogPreviewJobStage\s*=([\s\S]*?);/, 'stage union'));
const labelBody = capture(/export const CATALOG_PREVIEW_STAGE_LABELS:[\s\S]*?=\s*\{([\s\S]*?)\n\};/, 'stage labels');
const labels = [...labelBody.matchAll(/^\s*([A-Z_]+):/gm)].map((match) => match[1]);
const orderBody = capture(/export const CATALOG_PREVIEW_STAGE_ORDER\s*=\s*\[([\s\S]*?)\n\]\s*as const/, 'stage order');
const order = quotedValues(orderBody);
const failures = [];

const assertExact = (name, actual) => {
  if (actual.length !== new Set(actual).size || actual.join('|') !== expected.join('|')) {
    failures.push({ name, expected, actual });
  }
};
assertExact('CatalogPreviewJobStage union', union);
assertExact('CATALOG_PREVIEW_STAGE_LABELS keys', labels);
assertExact('CATALOG_PREVIEW_STAGE_ORDER', order);
if (!source.includes('getCatalogPreviewStageIndex') || !source.includes('CATALOG_PREVIEW_STAGE_ORDER.indexOf(stage)')) {
  failures.push({ name: 'shared stage index helper', message: 'Stage progress calculation is not based on the shared order.' });
}
if (!lifecycleSource.includes('getCatalogPreviewStageIndex(previewStage)')) {
  failures.push({ name: 'Lifecycle stepper uses shared stage index', message: 'CatalogLifecycleControls does not use the shared progress helper.' });
}
if (!lifecycleSource.includes('clearAppliedPreviewState') || !lifecycleSource.includes('setFullJob(null)') || !lifecycleSource.includes('setPassword(\'\')')) {
  failures.push({ name: 'Full Apply success cleanup', message: 'Applied Preview state cleanup is incomplete.' });
}

const result = {
  success: failures.length === 0,
  stages: { union: union.length, labels: labels.length, order: order.length },
  expectedOrder: expected,
  failures,
};
process.stdout.write(`${JSON.stringify(result)}\n`);
if (failures.length) process.exitCode = 1;
