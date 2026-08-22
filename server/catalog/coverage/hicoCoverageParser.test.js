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

test('coverage parser keeps plain unknown and carrier labels fail-closed', () => {
  const unknown = parseHicoCoverage('Narnia');
  assert.deepEqual(unknown.destinations, []);
  assert.equal(unknown.status, 'UNKNOWN_DESTINATION');
  assert.equal(unknown.needsReview, true);

  const carrier = parseHicoCoverage('China Unicom');
  assert.deepEqual(carrier.destinations, []);
  assert.deepEqual(carrier.networks, ['China Unicom']);
  assert.equal(carrier.status, 'CARRIER_ONLY');
  assert.equal(carrier.needsReview, true);
});

test('coverage parser treats auto-network country lists as destinations', () => {
  const result = parseHicoCoverage('Tự động nhận mạng: Bỉ, Pháp, Đức, Ý');
  assert.deepEqual(result.destinations.map(({ name }) => name), ['Bỉ', 'Pháp', 'Đức', 'Ý']);
  assert.deepEqual(result.networks, []);
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.needsReview, false);
});

test('coverage parser treats auto-network carrier lists as carrier-only', () => {
  const result = parseHicoCoverage('Tự động nhận mạng: China Unicom, Dtac');
  assert.deepEqual(result.destinations, []);
  assert.deepEqual(result.networks, ['China Unicom', 'Dtac']);
  assert.equal(result.status, 'CARRIER_ONLY');
  assert.equal(result.needsReview, true);
});

test('coverage parser strips exact auto-select network prefixes into destinations', () => {
  const result = parseHicoCoverage('Tự động chọn nhà mạng tại các quốc gia/ vùng lãnh thổ: Anh, Áo, Bỉ');
  assert.deepEqual(result.destinations.map(({ name }) => name), ['Anh', 'Áo', 'Bỉ']);
  assert.deepEqual(result.networks, []);
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.rawLabel.startsWith('Tự động chọn nhà mạng'), true);

  const shortPrefix = parseHicoCoverage('Tự động chọn nhà mạng: Anh, Áo, Bỉ');
  assert.deepEqual(shortPrefix.destinations.map(({ name }) => name), ['Anh', 'Áo', 'Bỉ']);
});

test('coverage parser splits a compound structured destination list', () => {
  const result = parseHicoCoverage('USA, Canada, Mexico: AT&T');
  assert.deepEqual(result.destinations.map(({ name }) => name), ['USA', 'Canada', 'Mexico']);
  assert.deepEqual(result.networks, ['AT&T']);
  assert.equal(result.status, 'RESOLVED');
});

test('coverage parser handles multiple structured segments', () => {
  const result = parseHicoCoverage('Brazil: Vivo, TIM ; Chile: WOM, Movistar');
  assert.deepEqual(result.destinations.map(({ name }) => name), ['Brazil', 'Chile']);
  assert.deepEqual(result.networks, ['Vivo', 'TIM', 'WOM', 'Movistar']);
  assert.equal(result.status, 'RESOLVED');
});

test('coverage parser strips deterministic count prefixes and destination punctuation', () => {
  const result = parseHicoCoverage('51 quốc gia/ vùng lãnh thổ: Germany, Austria, Belgium; Slovenia., Vatican.');
  assert.deepEqual(result.destinations.map(({ name }) => name), ['Germany', 'Austria', 'Belgium', 'Slovenia', 'Vatican']);
  assert.equal(result.status, 'RESOLVED');
});

test('coverage parser canonicalizes aliases and deduplicates destination IDs', () => {
  const result = parseHicoCoverage('China: China Unicom; Mainland China: China Telecom; Trung Quốc: China Mobile');
  assert.deepEqual(result.destinations, [{ id: 'coverage-trung-quoc', name: 'Trung Quốc' }]);
});

test('coverage parser creates stable IDs for structural territory labels', () => {
  const result = parseHicoCoverage('Åland Islands: Carrier; Bỉ: Carrier');
  assert.deepEqual(result.destinations, [
    { id: 'coverage-aland-islands', name: 'Åland Islands' },
    { id: 'coverage-bi', name: 'Bỉ' },
  ]);
});
