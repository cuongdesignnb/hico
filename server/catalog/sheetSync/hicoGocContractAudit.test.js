import assert from 'node:assert/strict';
import test from 'node:test';
import { auditHicoGocValues } from './hicoGocContractAudit.js';

test('HICO GỐC contract audit reports safe branch and identity counts without raw rows', () => {
  const row = Array(25).fill('');
  row[0] = 'Sim & eSIM'; row[1] = 'Trung Quốc 500MB/ngày'; row[3] = 'Chia ngày'; row[11] = 'Trung Quốc: China Unicom';
  row[16] = 'SKU-SIM'; row[23] = 'WM-SIM'; row[17] = 'SKU-ESIM'; row[24] = 'WM-ESIM';
  const result = auditHicoGocValues([Array(25).fill('header'), row]);
  assert.equal(result.rowsRead, 1);
  assert.equal(result.rowsWithBothBranches, 1);
  assert.equal(result.physicalBranches, 1);
  assert.equal(result.esimBranches, 1);
  assert.equal(result.partialPhysicalIdentity, 0);
  assert.equal(result.partialEsimIdentity, 0);
  assert.equal('sku' in result, false);
});

test('HICO GỐC contract audit separates physical and eSIM branch defects', () => {
  const row = Array(25).fill('');
  row[0] = 'Sim & eSIM'; row[1] = 'Trung Quốc 500MB/ngày'; row[3] = 'Chia ngày'; row[11] = 'Trung Quốc: China Unicom';
  row[4] = 'not-a-price'; row[16] = 'SKU-PHYSICAL';
  row[5] = '70000'; row[24] = 'WM-ESIM';
  const result = auditHicoGocValues([Array(25).fill('header'), row]);
  assert.equal(result.branchDiagnostics.physical.rowsWithData, 1);
  assert.equal(result.branchDiagnostics.physical.missingWmid, 1);
  assert.equal(result.branchDiagnostics.physical.invalidPrice, 1);
  assert.equal(result.branchDiagnostics.physical.partialIdentity, 1);
  assert.equal(result.branchDiagnostics.esim.rowsWithData, 1);
  assert.equal(result.branchDiagnostics.esim.missingSku, 1);
  assert.equal(result.branchDiagnostics.esim.missingWmid, 0);
  assert.equal(result.branchDiagnostics.esim.complete, 0);
  assert.deepEqual(result.coverage.destinationNames, { 'coverage-trung-quoc': 'Trung Quốc' });
});
