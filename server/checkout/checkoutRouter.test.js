import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { CheckoutError } from './checkoutError.js';
import { createCheckoutRouter } from './checkoutRouter.js';

const withServer = async (router, callback) => {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0);
  await once(server, 'listening');
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); await once(server, 'close'); }
};

test('request readiness allows pure eSIM validation even when global health reports physical inventory missing', async () => {
  let readinessCalls = 0;
  const router = createCheckoutRouter({
    env: { CHECKOUT_ENGINE: 'canonical' },
    checkoutHealthService: { getHealth: async () => { throw new Error('global health must not gate the request'); } },
    checkoutReadinessService: {
      assertReady: async (request) => {
        readinessCalls += 1;
        assert.deepEqual(request.items, [{ variantId: 'v-esim', quantity: 1 }]);
        return { ready: true, cartKinds: ['ESIM'], requiredCapabilities: ['ESIM_FULFILLMENT', 'PROVIDER_OR_MANUAL_QR'], blockingReasons: [], warnings: [] };
      },
    },
    checkoutService: { validate: async () => ({ valid: true, currency: 'VND', subtotal: 100000, items: [], errors: [], warnings: [] }) },
    logger: { warn() {} },
  });

  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/checkout/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ variantId: 'v-esim', quantity: 1 }] }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).valid, true);
  });
  assert.equal(readinessCalls, 1);
});

test('request readiness returns typed blocker details without exposing global health internals', async () => {
  const router = createCheckoutRouter({
    env: { CHECKOUT_ENGINE: 'canonical' },
    checkoutReadinessService: {
      assertReady: async () => { throw new CheckoutError('Kho SIM vật lý chưa được cấu hình.', 'CHECKOUT_NOT_READY', 503, { ready: false, cartKinds: ['PHYSICAL_SIM'], requiredCapabilities: ['PHYSICAL_INVENTORY', 'SHIPPING'], blockingReasons: ['PHYSICAL_INVENTORY_NOT_CONFIGURED'], warnings: [] }); },
    },
    checkoutService: { validate: async () => ({ valid: true }) },
    logger: { warn() {} },
  });

  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/checkout/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ variantId: 'v-physical', quantity: 1 }] }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Kho SIM vật lý chưa được cấu hình.',
      code: 'CHECKOUT_NOT_READY',
      details: {
        ready: false,
        cartKinds: ['PHYSICAL_SIM'],
        requiredCapabilities: ['PHYSICAL_INVENTORY', 'SHIPPING'],
        blockingReasons: ['PHYSICAL_INVENTORY_NOT_CONFIGURED'],
        warnings: [],
      },
    });
  });
});
