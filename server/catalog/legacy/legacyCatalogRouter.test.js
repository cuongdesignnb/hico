import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { createLegacyCatalogRouter } from './legacyCatalogRouter.js';
import {
  LegacyCatalogWriteLockedError,
} from './legacyCatalogService.js';

const withServer = async (service, callback) => {
  const app = express();
  app.use(express.json());
  app.use('/api', createLegacyCatalogRouter({ legacyCatalogService: service }));
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
};

test('legacy catalog API returns GET data and source status', async () => {
  const service = {
    listDestinations: async () => [{ id: 'd1' }],
    listPackages: async () => [{ id: 'p1' }],
    getSourceStatus: async () => ({
      readSource: 'canonical',
      legacyWriteEnabled: false,
    }),
  };
  await withServer(service, async (baseUrl) => {
    const destinations = await fetch(`${baseUrl}/api/admin/destinations`);
    const packages = await fetch(`${baseUrl}/api/admin/packages`);
    const status = await fetch(`${baseUrl}/api/admin/catalog/source-status`);
    assert.equal(destinations.status, 200);
    assert.equal(packages.status, 200);
    assert.equal(status.status, 200);
    assert.equal((await status.json()).legacyWriteEnabled, false);
  });
});

test('canonical mode write lock returns controlled 409 for every write verb', async () => {
  const locked = () => {
    throw new LegacyCatalogWriteLockedError();
  };
  const service = {
    createDestination: locked,
    updateDestination: locked,
    deleteDestination: locked,
    createPackage: locked,
    updatePackage: locked,
    deletePackage: locked,
  };
  const requests = [
    ['POST', '/api/admin/destinations'],
    ['PUT', '/api/admin/destinations/d1'],
    ['DELETE', '/api/admin/destinations/d1'],
    ['POST', '/api/admin/packages'],
    ['PUT', '/api/admin/packages/p1'],
    ['DELETE', '/api/admin/packages/p1'],
  ];
  await withServer(service, async (baseUrl) => {
    for (const [method, endpoint] of requests) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : '{}',
      });
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), {
        error: 'Catalog đang ở chế độ canonical. Hãy sử dụng API quản lý catalog mới.',
      });
    }
  });
});

test('internal API failures do not expose stack traces', async () => {
  const service = {
    listDestinations: async () => {
      const error = new Error('internal');
      error.stack = 'SECRET_STACK';
      throw error;
    },
  };
  await withServer(service, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/destinations`);
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(await response.json()), /SECRET_STACK/);
  });
});
