import assert from 'node:assert/strict';
import test from 'node:test';
import { collectMediaReferences, walkImageValues } from './mediaAuditSupport.js';

test('media inventory findings contain paths and classifications, never source values', () => {
  const findings = walkImageValues({
    email: 'owner@example.test',
    image: 'https://cdn.example.test/product.webp',
    secret: 'do-not-print',
    attachment: 'data:image/png;base64,PRIVATE_BYTES',
  });
  assert.deepEqual(findings.externalImageUrls, [{ path: '$.image', kind: 'external-url' }]);
  assert.deepEqual(findings.dataUrls, [{ path: '$.attachment', kind: 'data-url' }]);
  assert.equal(JSON.stringify(findings).includes('owner@example.test'), false);
  assert.equal(JSON.stringify(findings).includes('PRIVATE_BYTES'), false);
  assert.equal(JSON.stringify(findings).includes('do-not-print'), false);
});

test('media references classify missing, duplicate and ownership source deterministically', () => {
  const assets = [{ id: 'media_owned', publicUrl: '/uploads/owned.webp', status: 'ACTIVE' }];
  const entities = [{
    source: 'canonical-products',
    value: { id: 'product-1', primaryMediaId: 'media_owned', galleryMediaIds: ['media_owned', 'media_owned', 'media_missing'] },
  }];
  const report = collectMediaReferences(entities, assets);
  assert.deepEqual(report.missingAssets, [{ source: 'canonical-products', path: '$.galleryMediaIds.2', kind: 'missing-media-id' }]);
  assert.deepEqual(report.duplicateReferences, [{ source: 'canonical-products', path: '$.galleryMediaIds.1', kind: 'duplicate-reference' }]);
  assert.equal(report.references.every((reference) => reference.source === 'canonical-products'), true);
  assert.deepEqual(report.orphanAssets, []);
});
