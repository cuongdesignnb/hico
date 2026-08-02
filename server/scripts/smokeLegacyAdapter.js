#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  open,
  readFile,
  rename,
  rm,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDirectory = path.dirname(
  fileURLToPath(new URL('../hicoBackend.js', import.meta.url)),
);
const uploadsDirectory = path.join(serverDirectory, 'uploads');
const baseUrl = 'http://127.0.0.1:5000/api';
const writeLockMessage =
  'Catalog đang ở chế độ canonical. Hãy sử dụng API quản lý catalog mới.';

const hashFile = async (name) => createHash('sha256')
  .update(await readFile(path.join(uploadsDirectory, name)))
  .digest('hex');

const restoreFile = async (name, content) => {
  const filePath = path.join(uploadsDirectory, name);
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.restore.tmp`;
  const handle = await open(tempFile, 'wx');
  try {
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    await rename(tempFile, filePath);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(tempFile, { force: true }).catch(() => undefined);
    throw error;
  }
};

const waitForServer = async (child) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited before smoke test: ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/admin/catalog/source-status`);
      if (response.ok) return;
    } catch {
      // Backend is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Backend did not become ready for legacy adapter smoke test.');
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

const requestJson = async (endpoint, options) => {
  const response = await fetch(`${baseUrl}${endpoint}`, options);
  const body = await response.json();
  return { status: response.status, body };
};

const exerciseLegacyWrites = async () => {
  const marker = `PR4-${Date.now()}`;
  const destination = await requestJson('/admin/destinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku: marker,
      name: marker,
      flag: 'QA',
      dataLimit: '1 GB',
      duration: '1 Ngày',
      price: 1,
      network: 'QA',
    }),
  });
  const legacyPackage = await requestJson('/admin/packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku: marker,
      name: marker,
      coverage: 'QA',
      dataLimit: '1 GB',
      duration: '1 Ngày',
      price: 1,
    }),
  });
  const updateDestination = await requestJson(
    `/admin/destinations/${encodeURIComponent(destination.body.id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${marker}-updated` }),
    },
  );
  const updatePackage = await requestJson(
    `/admin/packages/${encodeURIComponent(legacyPackage.body.id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${marker}-updated` }),
    },
  );
  const deleteDestination = await requestJson(
    `/admin/destinations/${encodeURIComponent(destination.body.id)}`,
    { method: 'DELETE' },
  );
  const deletePackage = await requestJson(
    `/admin/packages/${encodeURIComponent(legacyPackage.body.id)}`,
    { method: 'DELETE' },
  );
  return [
    destination,
    legacyPackage,
    updateDestination,
    updatePackage,
    deleteDestination,
    deletePackage,
  ].every((result) => result.status === 200);
};

const readSource = async (source, callback) => {
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
    const destinations = await requestJson('/admin/destinations');
    const packages = await requestJson('/admin/packages');
    const status = await requestJson('/admin/catalog/source-status');
    const extra = callback ? await callback() : {};
    return {
      destinations: destinations.body,
      packages: packages.body,
      status: status.body,
      ...extra,
    };
  } finally {
    await stopServer(child);
  }
};

const before = {
  destinations: await hashFile('destinations.json'),
  packages: await hashFile('packages.json'),
  manualQrs: await hashFile('manual_qrs.json'),
  pointer: await hashFile('catalog_current.json'),
};
const originalLegacyFiles = {
  destinations: await readFile(path.join(uploadsDirectory, 'destinations.json')),
  packages: await readFile(path.join(uploadsDirectory, 'packages.json')),
};
let legacy;
let canonical;
let rollback;
try {
  legacy = await readSource('legacy', async () => ({
    writesWorked: await exerciseLegacyWrites(),
  }));
  canonical = await readSource('canonical', async () => {
    const lockedRequests = [
      ['POST', '/admin/destinations'],
      ['PUT', '/admin/destinations/qa'],
      ['DELETE', '/admin/destinations/qa'],
      ['POST', '/admin/packages'],
      ['PUT', '/admin/packages/qa'],
      ['DELETE', '/admin/packages/qa'],
    ];
    const lockResults = [];
    for (const [method, endpoint] of lockedRequests) {
      lockResults.push(await requestJson(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : '{}',
      }));
    }
    const parity = await requestJson('/admin/catalog/legacy-parity/run', {
      method: 'POST',
    });
    return {
      writesLocked: lockResults.every((result) => (
        result.status === 409 && result.body.error === writeLockMessage
      )),
      parityStatus: parity.status,
      parity: parity.body,
    };
  });
  rollback = await readSource('legacy', async () => ({
    writesWorked: await exerciseLegacyWrites(),
  }));
} finally {
  await Promise.all([
    restoreFile('destinations.json', originalLegacyFiles.destinations),
    restoreFile('packages.json', originalLegacyFiles.packages),
  ]);
}

const restored = {
  destinations: await hashFile('destinations.json'),
  packages: await hashFile('packages.json'),
  manualQrs: await hashFile('manual_qrs.json'),
  pointer: await hashFile('catalog_current.json'),
};
const exactJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const result = {
  legacyDestinations: legacy.destinations.length,
  adaptedDestinations: canonical.destinations.length,
  legacyPackages: legacy.packages.length,
  adaptedPackages: canonical.packages.length,
  destinationParity: exactJson(legacy.destinations, canonical.destinations),
  packageParity: exactJson(legacy.packages, canonical.packages),
  canonicalWritesLocked: canonical.writesLocked,
  sourceStatusCorrect: (
    legacy.status.readSource === 'legacy'
    && legacy.status.legacyWriteEnabled === true
    && canonical.status.readSource === 'canonical'
    && canonical.status.legacyWriteEnabled === false
  ),
  parityApiPassed: canonical.parityStatus === 200 && canonical.parity.success,
  rollbackGetWorked: (
    exactJson(legacy.destinations, rollback.destinations)
    && exactJson(legacy.packages, rollback.packages)
  ),
  rollbackWriteWorked: legacy.writesWorked && rollback.writesWorked,
  legacyFilesUnchanged: (
    before.destinations === restored.destinations
    && before.packages === restored.packages
  ),
  manualQrsUnchanged: before.manualQrs === restored.manualQrs,
  canonicalPointerUnchanged: before.pointer === restored.pointer,
};

if (Object.values(result).some((value) => value === false)) {
  throw new Error(`Legacy adapter smoke failed: ${JSON.stringify(result)}`);
}
console.log(JSON.stringify(result, null, 2));
