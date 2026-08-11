import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProviderReferenceRecords,
  canonicalPayload,
  discoverProviderReferences,
} from './providerReferenceDiscovery.js';

const source = (overrides = {}) => ({
  'WM Product ID': ' WM-e-CN-500MB-1D ',
  'Product ID': 'LeSIM-wm00830001',
  'Product Name': 'Mainland China, 1 Day, 500MB /day, 128kbps',
  'Product Language': '',
  'Applicable Region': 'Mainland China',
  'Product Type': '0',
  'Price (wholesaler cost)': '13',
  'C-end Price': '0',
  'C-end Product': '0',
  leSIM: '1',
  ...overrides,
});

test('collapses mirrored records with identical normalized provider payloads', () => {
  const records = [
    { wmproductId: 'WM-e-CN-500MB-1D', payload: source(), sourceRef: 'B1407' },
    { wmproductId: 'WM-e-CN-500MB-1D', payload: source({ 'Product Name': ' Mainland China, 1 Day, 500MB /day, 128kbps ' }), sourceRef: 'O1362' },
  ];
  const [result] = discoverProviderReferences(records, ['WM-e-CN-500MB-1D']);
  assert.equal(result.status, 'DUPLICATE_IDENTICAL_COLLAPSED');
  assert.equal(result.occurrenceCount, 2);
  assert.equal(result.payloadCandidates.length, 1);
  assert.equal(result.logicalCandidate.providerProductId, 'LeSIM-wm00830001');
  assert.deepEqual(result.payloadCandidates[0].sourceRefs, ['B1407', 'O1362']);
});

test('keeps different payloads ambiguous and blocks a logical candidate', () => {
  const records = [
    { wmproductId: 'WM-e-CN-500MB-1D', payload: source(), sourceRef: 'B1407' },
    { wmproductId: 'WM-e-CN-500MB-1D', payload: source({ 'Product ID': 'different' }), sourceRef: 'O1362' },
  ];
  const [result] = discoverProviderReferences(records, ['WM-e-CN-500MB-1D']);
  assert.equal(result.status, 'PROVIDER_AMBIGUOUS');
  assert.equal(result.logicalCandidate, null);
  assert.equal(result.payloadCandidates.length, 2);
});

test('keeps absent WMIDs as PROVIDER_NOT_FOUND', () => {
  const [result] = discoverProviderReferences([], ['WM-e-CN-500MB-2D']);
  assert.equal(result.status, 'PROVIDER_NOT_FOUND');
  assert.equal(result.logicalCandidate, null);
});

test('builds one record per mirrored WMID block without using row identity', () => {
  const headers = ['STT', 'WM Product ID', 'Product ID', 'Product Name', 'Product Type', 'Price (wholesaler cost)', 'C-end Price', 'C-end Product', 'leSIM', '', '', '', 'STT', 'WM Product ID', 'Product ID', 'Product Name', 'Product Type', 'Price (wholesaler cost)', 'C-end Price', 'C-end Product', 'leSIM'];
  const rows = [['1407', 'WM-e-CN-500MB-1D', 'P1', 'CN 1D', '0', '13', '0', '0', '1', '', '', '', '1362', 'WM-e-CN-500MB-1D', 'P1', 'CN 1D', '0', '13', '0', '0', '1']];
  const records = buildProviderReferenceRecords({ headers, rows });
  assert.equal(records.length, 2);
  assert.deepEqual(records.map((record) => record.wmproductId), ['WM-e-CN-500MB-1D', 'WM-e-CN-500MB-1D']);
  assert.equal(canonicalPayload(records[0].payload).providerProductId, 'P1');
});
