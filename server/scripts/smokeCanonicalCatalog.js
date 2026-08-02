#!/usr/bin/env node
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDirectory = path.dirname(
  fileURLToPath(new URL('../hicoBackend.js', import.meta.url)),
);
const baseUrl = 'http://127.0.0.1:5000/api';
const manualQrsFile = path.join(serverDirectory, 'uploads', 'manual_qrs.json');

const waitForServer = async (child) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited before smoke test: ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/admin/catalog/migration/status`);
      if (response.ok) return;
    } catch {
      // The backend is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Backend did not become ready for smoke testing.');
};

const stopServer = async (child) => {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
};

const readSource = async (source, { exerciseMigrationApi = false } = {}) => {
  const child = spawn(process.execPath, ['hicoBackend.js'], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      CATALOG_READ_SOURCE: source,
      CATALOG_CANONICAL_FALLBACK: 'false',
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  try {
    await waitForServer(child);
    const productsResponse = await fetch(`${baseUrl}/admin/catalog/products`);
    if (!productsResponse.ok) {
      throw new Error(`${source} catalog returned ${productsResponse.status}.`);
    }
    const products = await productsResponse.json();
    const detailResponse = await fetch(
      `${baseUrl}/catalog/products/${encodeURIComponent(products[0].id)}`,
    );
    if (!detailResponse.ok) {
      throw new Error(`${source} product detail returned ${detailResponse.status}.`);
    }
    const statusResponse = await fetch(
      `${baseUrl}/admin/catalog/migration/status`,
    );
    let migrationApi;
    if (exerciseMigrationApi) {
      const validateResponse = await fetch(
        `${baseUrl}/admin/catalog/migration/validate`,
        { method: 'POST' },
      );
      const validateResult = await validateResponse.json();
      const runResponse = await fetch(
        `${baseUrl}/admin/catalog/migration/run`,
        { method: 'POST' },
      );
      const runResult = await runResponse.json();
      const reportResponse = await fetch(
        `${baseUrl}/admin/catalog/migration/reports/${
          encodeURIComponent(runResult.migrationId)
        }`,
      );
      const reportResult = await reportResponse.json();
      migrationApi = {
        validateStatus: validateResponse.status,
        runStatus: runResponse.status,
        reportStatus: reportResponse.status,
        statusOk: (await statusResponse.clone().json()).migrated === true,
        validateOk: validateResult.valid === true,
        runUnchanged: runResult.unchanged === true,
        reportSuccess: reportResult.success === true,
        containsSecret: /merchantId|deptId|token|smtpPass|apiKey/i.test(
          JSON.stringify({ validateResult, runResult, reportResult }),
        ),
      };
    }
    return {
      products,
      detail: await detailResponse.json(),
      status: await statusResponse.json(),
      migrationApi,
    };
  } finally {
    await stopServer(child);
  }
};

const projectVariant = (variant) => JSON.stringify([
  variant.id,
  variant.sku,
  variant.wmproductId ?? null,
  variant.price,
  variant.compareAtPrice ?? null,
]);

const flattenVariants = (products) => products.flatMap(
  (product) => product.variants ?? [],
);

const fileHash = async (filePath) => createHash('sha256')
  .update(await readFile(filePath))
  .digest('hex');

const manualQrsBefore = await fileHash(manualQrsFile);
const legacy = await readSource('legacy', { exerciseMigrationApi: true });
const canonical = await readSource('canonical');
const rollback = await readSource('legacy');
const manualQrsAfter = await fileHash(manualQrsFile);
const legacyVariants = flattenVariants(legacy.products);
const canonicalVariants = flattenVariants(canonical.products);
const sameStrings = (left, right) => (
  [...left].sort().join('\n') === [...right].sort().join('\n')
);
const result = {
  legacyProducts: legacy.products.length,
  canonicalProducts: canonical.products.length,
  legacyVariants: legacyVariants.length,
  canonicalVariants: canonicalVariants.length,
  productIdsEqual: sameStrings(
    legacy.products.map((item) => item.id),
    canonical.products.map((item) => item.id),
  ),
  variantBusinessFieldsEqual: sameStrings(
    legacyVariants.map(projectVariant),
    canonicalVariants.map(projectVariant),
  ),
  detailIdEqual: legacy.detail.id === canonical.detail.id,
  detailVariantCountEqual: (
    legacy.detail.variants.length === canonical.detail.variants.length
  ),
  migrationId: canonical.status.manifest?.migrationId,
  migrationApiPassed: (
    legacy.migrationApi.validateStatus === 200
    && legacy.migrationApi.runStatus === 200
    && legacy.migrationApi.reportStatus === 200
    && legacy.migrationApi.statusOk
    && legacy.migrationApi.validateOk
    && legacy.migrationApi.runUnchanged
    && legacy.migrationApi.reportSuccess
    && !legacy.migrationApi.containsSecret
  ),
  manualQrsUnchanged: manualQrsBefore === manualQrsAfter,
  rollbackWorked: (
    rollback.status.source === 'legacy'
    && rollback.products.length === legacy.products.length
  ),
};

if (Object.values(result).some((value) => value === false)) {
  throw new Error(`Canonical smoke parity failed: ${JSON.stringify(result)}`);
}
console.log(JSON.stringify(result, null, 2));
