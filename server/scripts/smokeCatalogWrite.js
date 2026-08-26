import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDirectory = fileURLToPath(new URL('../', import.meta.url));
const uploadsDirectory = path.join(serverDirectory, 'uploads');
const versionsDirectory = path.join(uploadsDirectory, 'catalog_versions');
const reportsDirectory = path.join(uploadsDirectory, 'migration_reports');
const baseUrl = 'http://127.0.0.1:5000';
const runtimeFiles = [
  'catalog_current.json',
  'catalog_products.json',
  'catalog_variants.json',
  'catalog_idempotency.json',
  'catalog_audit.json',
  'catalog_slug_history.json',
];
const legacyFiles = [
  'destinations.json',
  'packages.json',
  'manual_qrs.json',
];

const hash = (content) => createHash('sha256').update(content).digest('hex');

const readOptional = async (filePath) => {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

const atomicRestore = async (filePath, content) => {
  if (content === null) {
    await rm(filePath, { force: true });
    return;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.restore`;
  await writeFile(tempFile, content);
  await rename(tempFile, filePath);
};

const listNames = async (directory) => {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error?.code === 'ENOENT') return new Set();
    throw error;
  }
};

const waitForServer = async (child) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited before smoke test: ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/admin/catalog/source-status`);
      if (response.ok) return;
    } catch {
      // Backend is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for backend.');
};

const startBackend = async () => {
  const child = spawn(process.execPath, ['hicoBackend.js'], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      CATALOG_READ_SOURCE: 'canonical',
      CATALOG_CANONICAL_FALLBACK: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume();
  child.stderr.resume();
  await waitForServer(child);
  return child;
};

const stopBackend = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
};

const api = async (url, {
  method = 'GET',
  body,
} = {}) => {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { status: response.status, body: payload, headers: response.headers };
};

const expectStatus = (result, status, label) => {
  if (result.status !== status) {
    throw new Error(`${label}: expected ${status}, received ${result.status}`);
  }
  return result.body;
};

const initialRuntime = new Map();
const initialLegacyHashes = new Map();
for (const name of runtimeFiles) {
  initialRuntime.set(name, await readOptional(path.join(uploadsDirectory, name)));
}
for (const name of legacyFiles) {
  initialLegacyHashes.set(
    name,
    hash(await readFile(path.join(uploadsDirectory, name))),
  );
}
const initialVersions = await listNames(versionsDirectory);
const initialReports = await listNames(reportsDirectory);
const baselinePointer = JSON.parse(
  initialRuntime.get('catalog_current.json').toString('utf8'),
);
const baselineVersionId = baselinePointer.versionId
  ?? baselinePointer.migrationId;

let backend;
const stamp = `${Date.now()}-${process.pid}`;
const productId = `smoke-product-${stamp}`;
const productSlug = `smoke-product-${stamp}`;
const variantId = `smoke-variant-${stamp}`;
const variantSku = `SMOKE-SKU-${stamp}`;
const summary = {
  baselineVersionId,
};

try {
  backend = await startBackend();
  const source = expectStatus(
    await api('/api/admin/catalog/source-status'),
    200,
    'source status',
  );
  if (source.readSource !== 'canonical' || source.legacyWriteEnabled !== false) {
    throw new Error('Canonical source status is incorrect.');
  }

  const createProductRequest = {
    idempotencyKey: `smoke-create-product-${stamp}`,
    catalogVersionId: baselineVersionId,
    product: {
      id: productId,
      name: 'Sản phẩm smoke PR5',
      slug: productSlug,
      operation: 'new_subscription',
      coverageType: 'country',
      coverageIds: ['vn'],
      image: '/images/vietnam.png',
      description: '<p onclick="bad()">Smoke<script>bad()</script></p>',
      featured: false,
    },
  };
  const createdProduct = expectStatus(
    await api('/api/admin/catalog/products', {
      method: 'POST',
      body: createProductRequest,
    }),
    201,
    'create product',
  );
  summary.createdProductDraft = createdProduct.product.status === 'draft';
  const replay = await api('/api/admin/catalog/products', {
    method: 'POST',
    body: createProductRequest,
  });
  expectStatus(replay, 201, 'idempotent product retry');
  summary.idempotencyReplay = replay.headers.get('x-idempotent-replay') === 'true'
    && replay.body.catalogVersionId === createdProduct.catalogVersionId;
  const idempotencyConflict = await api('/api/admin/catalog/products', {
    method: 'POST',
    body: {
      ...createProductRequest,
      product: {
        ...createProductRequest.product,
        name: 'Payload khác',
      },
    },
  });
  summary.idempotencyConflict = idempotencyConflict.status === 409
    && idempotencyConflict.body.code === 'IDEMPOTENCY_CONFLICT';

  const createdVariant = expectStatus(
    await api(`/api/admin/catalog/products/${productId}/variants`, {
      method: 'POST',
      body: {
        idempotencyKey: `smoke-create-variant-${stamp}`,
        catalogVersionId: createdProduct.catalogVersionId,
        variant: {
          id: variantId,
          sku: variantSku,
          dataLimit: '1 GB',
          duration: '1 Ngày',
          price: 10000,
          compareAtPrice: 12000,
          currency: 'VND',
          medium: 'esim',
          supplier: 'hico',
          fulfillmentMethod: 'HICO_MANUAL_QR',
          requiresExistingSim: false,
        },
      },
    }),
    201,
    'create variant',
  );
  summary.createdVariantInactive = createdVariant.variant.active === false;

  const catalogVersionConflict = await api(
    `/api/admin/catalog/products/${productId}`,
    {
      method: 'PUT',
      body: {
        idempotencyKey: `smoke-stale-catalog-${stamp}`,
        catalogVersionId: baselineVersionId,
        version: 1,
        changes: { name: 'Stale catalog update' },
      },
    },
  );
  summary.catalogVersionConflict = catalogVersionConflict.status === 409
    && catalogVersionConflict.body.code === 'CATALOG_VERSION_CONFLICT';

  const readiness = expectStatus(
    await api(`/api/admin/catalog/products/${productId}/publish-readiness`, {
      method: 'POST',
    }),
    200,
    'publish readiness',
  );
  summary.publishReadiness = readiness.publishable === true;

  const updatedProduct = expectStatus(
    await api(`/api/admin/catalog/products/${productId}`, {
      method: 'PUT',
      body: {
        idempotencyKey: `smoke-update-product-${stamp}`,
        catalogVersionId: createdVariant.catalogVersionId,
        version: 1,
        changes: { name: 'Sản phẩm smoke PR5 đã cập nhật' },
      },
    }),
    200,
    'update product',
  );
  summary.productUpdated = updatedProduct.product.version === 2
    && updatedProduct.product.slug === productSlug;
  const productDetail = expectStatus(
    await api(`/api/admin/catalog/products/${productId}`),
    200,
    'canonical product detail',
  );
  summary.canonicalGetReflectsWrite = productDetail.product.version === 2
    && productDetail.product.name === 'Sản phẩm smoke PR5 đã cập nhật'
    && productDetail.catalogVersionId === updatedProduct.catalogVersionId;

  const stale = await api(`/api/admin/catalog/products/${productId}`, {
    method: 'PUT',
    body: {
      idempotencyKey: `smoke-stale-product-${stamp}`,
      catalogVersionId: updatedProduct.catalogVersionId,
      version: 1,
      changes: { name: 'Stale update' },
    },
  });
  summary.entityVersionConflict = stale.status === 409
    && stale.body.code === 'ENTITY_VERSION_CONFLICT';

  const duplicateSku = await api(
    `/api/admin/catalog/products/${productId}/variants`,
    {
      method: 'POST',
      body: {
        idempotencyKey: `smoke-duplicate-sku-${stamp}`,
        catalogVersionId: updatedProduct.catalogVersionId,
        variant: {
          id: `duplicate-${variantId}`,
          sku: variantSku,
          price: 10000,
          currency: 'VND',
          medium: 'esim',
          supplier: 'hico',
          fulfillmentMethod: 'HICO_MANUAL_QR',
          requiresExistingSim: false,
        },
      },
    },
  );
  summary.duplicateSkuMetadataOnly = duplicateSku.status === 201
    && duplicateSku.body.variant?.sku === variantSku;

  const duplicateSlug = await api('/api/admin/catalog/products', {
    method: 'POST',
    body: {
      idempotencyKey: `smoke-duplicate-slug-${stamp}`,
      catalogVersionId: updatedProduct.catalogVersionId,
      product: {
        id: `duplicate-${productId}`,
        name: 'Duplicate slug',
        slug: productSlug,
        operation: 'new_subscription',
        coverageType: 'country',
        coverageIds: ['jp'],
      },
    },
  });
  summary.slugConflict = duplicateSlug.status === 409
    && duplicateSlug.body.code === 'SLUG_CONFLICT';

  const archivedVariant = expectStatus(
    await api(
      `/api/admin/catalog/products/${productId}/variants/${variantId}/archive`,
      {
        method: 'POST',
        body: {
          idempotencyKey: `smoke-archive-variant-${stamp}`,
          catalogVersionId: updatedProduct.catalogVersionId,
          version: 1,
        },
      },
    ),
    200,
    'archive variant',
  );
  const archivedProduct = expectStatus(
    await api(`/api/admin/catalog/products/${productId}/archive`, {
      method: 'POST',
      body: {
        idempotencyKey: `smoke-archive-product-${stamp}`,
        catalogVersionId: archivedVariant.catalogVersionId,
        version: 2,
      },
    }),
    200,
    'archive product',
  );
  summary.archiveWorked = archivedVariant.variant.archived === true
    && archivedProduct.product.status === 'archived';

  const deleteCandidateId = `smoke-delete-${stamp}`;
  const deleteCandidate = expectStatus(
    await api('/api/admin/catalog/products', {
      method: 'POST',
      body: {
        idempotencyKey: `smoke-create-delete-${stamp}`,
        catalogVersionId: archivedProduct.catalogVersionId,
        product: {
          id: deleteCandidateId,
          name: 'Delete candidate',
          slug: deleteCandidateId,
          operation: 'new_subscription',
          coverageType: 'country',
          coverageIds: ['kr'],
        },
      },
    }),
    201,
    'create delete candidate',
  );
  const deleted = expectStatus(
    await api(`/api/admin/catalog/products/${deleteCandidateId}`, {
      method: 'DELETE',
      body: {
        idempotencyKey: `smoke-delete-candidate-${stamp}`,
        catalogVersionId: deleteCandidate.catalogVersionId,
        version: 1,
      },
    }),
    200,
    'hard delete draft',
  );
  summary.hardDeleteWorked = deleted.deleted === true;

  const legacyGet = await api('/api/admin/destinations');
  const legacyWrite = await api('/api/admin/destinations', {
    method: 'POST',
    body: { name: 'Blocked' },
  });
  summary.legacyAdapterWorked = legacyGet.status === 200;
  summary.legacyWriteLocked = legacyWrite.status === 409;

  const audit = expectStatus(
    await api('/api/admin/catalog/audit'),
    200,
    'audit list',
  );
  const versions = expectStatus(
    await api('/api/admin/catalog/versions'),
    200,
    'version list',
  );
  summary.auditWorked = audit.items.length >= 7;
  summary.versionListWorked = versions.length >= initialVersions.size + 7;
  summary.createdVersions = versions.length - initialVersions.size;

  const rollback = expectStatus(
    await api(`/api/admin/catalog/versions/${baselineVersionId}/rollback`, {
      method: 'POST',
      body: {
        idempotencyKey: `smoke-rollback-${stamp}`,
        catalogVersionId: deleted.catalogVersionId,
      },
    }),
    200,
    'rollback',
  );
  summary.rollbackCreatedVersion = rollback.catalogVersionId !== baselineVersionId;
  summary.rollbackVersionId = rollback.catalogVersionId;

  const parity = expectStatus(
    await api('/api/admin/catalog/legacy-parity/run', { method: 'POST' }),
    200,
    'legacy parity after rollback',
  );
  summary.legacyParityAfterRollback = parity.success === true;

  await stopBackend(backend);
  backend = await startBackend();
  const replayAfterRestart = await api('/api/admin/catalog/products', {
    method: 'POST',
    body: createProductRequest,
  });
  const auditAfterRestart = expectStatus(
    await api('/api/admin/catalog/audit'),
    200,
    'audit after restart',
  );
  summary.restartPersistence = replayAfterRestart.status === 201
    && replayAfterRestart.headers.get('x-idempotent-replay') === 'true'
    && auditAfterRestart.items.some(
      (record) => record.action === 'ROLLBACK_CATALOG',
    );

  for (const [key, value] of Object.entries(summary)) {
    if (
      !['baselineVersionId', 'rollbackVersionId', 'createdVersions'].includes(key)
      && value !== true
    ) {
      throw new Error(`Smoke assertion failed: ${key}`);
    }
  }
} finally {
  await stopBackend(backend);
  const currentVersions = await listNames(versionsDirectory);
  for (const name of currentVersions) {
    if (!initialVersions.has(name)) {
      const target = path.resolve(versionsDirectory, name);
      if (!target.startsWith(`${path.resolve(versionsDirectory)}${path.sep}`)) {
        throw new Error('Unsafe catalog version cleanup path.');
      }
      await rm(target, { recursive: true, force: true });
    }
  }
  const currentReports = await listNames(reportsDirectory);
  for (const name of currentReports) {
    if (!initialReports.has(name)) {
      await rm(path.join(reportsDirectory, name), { force: true });
    }
  }
  for (const [name, content] of initialRuntime) {
    await atomicRestore(path.join(uploadsDirectory, name), content);
  }
  for (const [name, expectedHash] of initialLegacyHashes) {
    const actualHash = hash(await readFile(path.join(uploadsDirectory, name)));
    if (actualHash !== expectedHash) {
      throw new Error(`${name} changed during catalog write smoke test.`);
    }
  }
}

console.log(JSON.stringify(summary, null, 2));
