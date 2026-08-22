import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHicoCoverage } from './hicoCoverageParser.js';

test('coverage parser resolves country and network segments independently', () => {
  const result = parseHicoCoverage('Trung Quốc: China Unicom, China Telecom; Nhật Bản: Softbank');
  assert.deepEqual(result.destinations, [
    { id: 'coverage-trung-quoc', name: 'Trung Quốc' },
    { id: 'coverage-nhat-ban', name: 'Nhật Bản' },
  ]);
  assert.deepEqual(result.networks, ['China Unicom', 'China Telecom', 'Softbank']);
  assert.equal(result.needsReview, false);
});

test('coverage parser strips deterministic prefixes and flags carrier-only labels', () => {
  const prefixed = parseHicoCoverage('51 quốc gia/vùng lãnh thổ: Trung Quốc: China Unicom');
  assert.deepEqual(prefixed.destinations, [{ id: 'coverage-trung-quoc', name: 'Trung Quốc' }]);
  assert.equal(prefixed.needsReview, false);

  const carrierOnly = parseHicoCoverage('Tự động nhận mạng: China Unicom, Dtac');
  assert.deepEqual(carrierOnly.destinations, []);
  assert.deepEqual(carrierOnly.networks, ['China Unicom', 'Dtac']);
  assert.equal(carrierOnly.carrierOnly, true);
  assert.equal(carrierOnly.needsReview, true);
});

test('coverage parser treats a structured left-hand label as an exact destination', () => {
  const result = parseHicoCoverage('Atlantis: Example Telecom');
  assert.deepEqual(result.destinations, [{ id: 'coverage-atlantis', name: 'Atlantis' }]);
  assert.deepEqual(result.networks, ['Example Telecom']);
  assert.equal(result.needsReview, false);
  assert.equal(result.status, 'RESOLVED');
});

test('coverage parser distinguishes missing coverage from an unstructured destination', () => {
  assert.equal(parseHicoCoverage('').status, 'MISSING');
  assert.equal(parseHicoCoverage('Narnia').status, 'UNKNOWN_DESTINATION');
  assert.equal(parseHicoCoverage('Trung Quốc').status, 'RESOLVED');
  assert.equal(parseHicoCoverage('Trung Quốc: China Unicom').status, 'RESOLVED');
});

test('coverage parser keeps an auto-network label as carrier-only without a network whitelist', () => {
  const result = parseHicoCoverage('Tự động nhận mạng: Carrier Anywhere');
  assert.deepEqual(result.destinations, []);
  assert.deepEqual(result.networks, ['Carrier Anywhere']);
  assert.equal(result.status, 'CARRIER_ONLY');
});
