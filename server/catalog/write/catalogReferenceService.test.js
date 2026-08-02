import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCatalogReferenceService } from './catalogReferenceService.js';

const writeJson = (filePath, value) => writeFile(
  filePath,
  `${JSON.stringify(value, null, 2)}\n`,
  'utf8',
);

test('reference service finds legacy/order/QR/review/provider references safely', async (t) => {
  const uploadsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'hico-references-'),
  );
  t.after(() => rm(uploadsDirectory, { recursive: true, force: true }));
  await mkdir(uploadsDirectory, { recursive: true });
  await Promise.all([
    writeJson(path.join(uploadsDirectory, 'destinations.json'), [{
      id: 'product-1',
      variants: [{ id: 'variant-1' }],
    }]),
    writeJson(path.join(uploadsDirectory, 'packages.json'), []),
    writeJson(path.join(uploadsDirectory, 'orders.json'), [{
      orderId: 'order-1',
      wmproductId: 'WM-1',
    }]),
    writeJson(path.join(uploadsDirectory, 'manual_qrs.json'), [{
      id: 'qr-1',
      variantId: 'variant-1',
      qrcode: 'LPA:SECRET-CONTENT',
    }]),
    writeJson(path.join(uploadsDirectory, 'reviews.json'), [{
      id: 'review-1',
      productId: 'product-1',
    }]),
  ]);
  const service = createCatalogReferenceService({ uploadsDirectory });
  const variant = {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'SKU-1',
    wmproductId: 'WM-1',
    providerOfferId: 'worldmove:WM-1',
    supplier: 'worldmove',
  };
  const productReferences = await service.productReferences(
    { id: 'product-1' },
    [variant],
  );
  const variantReferences = await service.variantReferences(variant);
  assert.ok(productReferences.some((item) => item.source === 'variants'));
  assert.ok(productReferences.some((item) => item.source === 'legacyCatalog'));
  assert.ok(productReferences.some((item) => item.source === 'reviews'));
  assert.ok(variantReferences.some((item) => item.source === 'legacyCatalog'));
  assert.ok(variantReferences.some((item) => item.source === 'providerMapping'));
  assert.ok(variantReferences.some((item) => item.source === 'orders'));
  assert.ok(variantReferences.some((item) => item.source === 'manualQr'));
  assert.equal(
    JSON.stringify({ productReferences, variantReferences })
      .includes('SECRET-CONTENT'),
    false,
  );
});

test('reference service returns no references for a canonical-native draft', async (t) => {
  const uploadsDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'hico-references-empty-'),
  );
  t.after(() => rm(uploadsDirectory, { recursive: true, force: true }));
  const service = createCatalogReferenceService({ uploadsDirectory });
  assert.deepEqual(
    await service.productReferences({ id: 'new-product' }, []),
    [],
  );
  assert.deepEqual(
    await service.variantReferences({
      id: 'new-variant',
      sku: 'NEW-SKU',
      supplier: 'hico',
    }),
    [],
  );
});

