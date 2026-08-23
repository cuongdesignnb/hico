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
  assert.equal(result.sourceContract.length, 25);
  assert.deepEqual(result.sourceContract.at(-1), {
    column: 'Y', rawHeader: 'header', normalizedBusinessMeaning: 'WMID eSIM', currentCodeMapping: 'wmproductIdEsim', match: 'MATCH',
  });
  assert.deepEqual(result.sourceTypeDiagnostics['Sim & eSIM'], {
    rawValue: 'Sim & eSIM', normalizedValue: 'Sim & eSIM', rowCount: 1,
    physicalIdentityCount: 1, esimIdentityCount: 1, bothIdentityCount: 1,
    noIdentityCount: 0, partialPhysicalIdentityCount: 0, partialEsimIdentityCount: 0,
    physicalCompleteCount: 1, esimCompleteCount: 1, sourceMediumConflictCount: 0,
    packageClass: 'STANDARD_TRAVEL',
  });
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

test('HICO GỐC contract audit records exclusive source and medium conflicts without raw rows', () => {
  const row = Array(25).fill('');
  row[0] = 'eSim'; row[1] = 'Japan 1GB'; row[3] = 'Chia ngày';
  row[4] = '70000'; row[5] = '80000'; row[16] = 'PHYSICAL-RUBBISH'; row[23] = 'WM-PHYSICAL-RUBBISH';
  row[17] = 'ESIM-1'; row[24] = 'WM-ESIM-1';
  const result = auditHicoGocValues([Array(25).fill('header'), row]);
  assert.equal(result.sourceTypeDiagnostics.eSim.sourceMediumConflictCount, 1);
  assert.equal('rawRows' in result, false);
});
