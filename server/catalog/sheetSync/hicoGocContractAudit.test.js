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
  assert.equal(result.rowsWithSimWmid, 1);
  assert.equal(result.rowsWithEsimWmid, 1);
  assert.equal(result.rowsWithBothWmid, 1);
  assert.equal(result.rowsWithoutWmid, 0);
  assert.equal(result.duplicateSimWmid, 0);
  assert.equal(result.duplicateEsimWmid, 0);
  assert.equal(result.wmidConflicts, 0);
  assert.equal(result.wmidConflictSemantics, 'commercial-critical payload differences; not automatic invalidation');
  assert.equal(result.partialPhysicalIdentity, 0);
  assert.equal(result.partialEsimIdentity, 0);
  assert.equal(result.sourceContract.length, 25);
  assert.deepEqual(result.sourceContract.at(-1), {
    column: 'Y', rawHeader: 'header', normalizedBusinessMeaning: 'WMID eSIM', currentCodeMapping: 'wmproductIdEsim', match: 'MATCH',
  });
  assert.deepEqual(result.sourceTypeDiagnostics['Sim & eSIM'], {
    rawValue: 'Sim & eSIM', normalizedValue: 'Sim & eSIM', rowCount: 1,
    physicalIdentityCount: 1, esimIdentityCount: 1, bothIdentityCount: 0,
    noIdentityCount: 0, partialPhysicalIdentityCount: 0, partialEsimIdentityCount: 0,
    physicalCompleteCount: 0, esimCompleteCount: 0, sourceMediumConflictCount: 0,
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
  assert.equal(result.branchDiagnostics.esim.complete, 1);
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

test('HICO GỐC contract audit reports WMID duplicate and conflict groups without raw data', () => {
  const first = Array(25).fill('');
  first[0] = 'Sim'; first[1] = 'Trung Quốc 500MB/ngày'; first[2] = '10'; first[3] = 'Chia ngày';
  first[4] = '70000'; first[11] = 'Trung Quốc: China Unicom'; first[16] = 'SKU-A'; first[23] = 'WM-SAME';
  const identical = [...first]; identical[16] = 'SKU-B';
  const conflict = [...first]; conflict[4] = '71000';
  const result = auditHicoGocValues([Array(25).fill('header'), first, identical, conflict]);
  assert.equal(result.duplicateSimWmid, 1);
  assert.equal(result.wmidConflicts, 1);
  assert.equal(result.operationalWmidAmbiguities, 1);
  assert.equal(result.simMissingSku, 0);
  assert.equal('rawRows' in result, false);
});

test('HICO GỐC contract audit exposes deterministic WMID difference metrics and safe samples', () => {
  const makeRow = ({ wmid, sku, duration = '10', productName = 'Trung Quốc 500MB/ngày', price = '70000', dataType = 'Chia ngày', coverage = 'Trung Quốc: China Unicom' }) => {
    const row = Array(25).fill('');
    row[0] = 'Sim'; row[1] = productName; row[2] = duration; row[3] = dataType;
    row[4] = price; row[11] = coverage; row[16] = sku; row[23] = wmid;
    return row;
  };
  const values = [
    Array(25).fill('header'),
    makeRow({ wmid: 'WM-SKU', sku: 'SKU-A' }),
    makeRow({ wmid: 'WM-SKU', sku: 'SKU-B' }),
    makeRow({ wmid: 'WM-DURATION', sku: 'SKU-C', duration: '10' }),
    makeRow({ wmid: 'WM-DURATION', sku: 'SKU-C', duration: '15' }),
    makeRow({ wmid: 'WM-PRICE', sku: 'SKU-D', price: '70000' }),
    makeRow({ wmid: 'WM-PRICE', sku: 'SKU-D', price: '80000' }),
    makeRow({ wmid: 'WM-DATA', sku: 'SKU-E', productName: 'Trung Quốc 500MB/ngày' }),
    makeRow({ wmid: 'WM-DATA', sku: 'SKU-E', productName: 'Trung Quốc 1GB/ngày' }),
    makeRow({ wmid: 'WM-COVERAGE', sku: 'SKU-F', coverage: 'Nhật Bản: Softbank' }),
    makeRow({ wmid: 'WM-COVERAGE', sku: 'SKU-F', coverage: 'Hàn Quốc: SKT' }),
  ];
  const result = auditHicoGocValues(values);
  assert.equal(result.uniqueSimWmid, 5);
  assert.equal(result.uniqueEsimWmid, 0);
  assert.equal(result.duplicateSimWmid, 5);
  assert.equal(result.sameWmidSamePayload, 1);
  assert.equal(result.sameWmidDifferentDuration, 1);
  assert.equal(result.sameWmidDifferentPrice, 1);
  assert.equal(result.sameWmidDifferentData, 1);
  assert.equal(result.sameWmidDifferentCoverage, 1);
  assert.equal(result.sameWmidOnlySkuDifferent, 1);
  assert.equal(result.wmidConflicts, 4);
  assert.equal(result.operationalWmidAmbiguities, 3);
  assert.equal(result.exactWmidDuplicatesCollapsed, 1);
  assert.equal(Object.values(result.wmidDifferenceSamples).flat().length, 5);
  assert.deepEqual(result.wmidDifferenceSamples.sameWmidOnlySkuDifferent[0].sheetRowNumbers, [2, 3]);
  assert.equal('rawLabel' in result.wmidDifferenceSamples.sameWmidDifferentCoverage[0], false);
  assert.equal(result.sourceContract.find((entry) => entry.currentCodeMapping === 'pricePhysical')?.normalizedBusinessMeaning, 'Giá SIM / Top-up');
  assert.equal(result.sourceContract.find((entry) => entry.currentCodeMapping === 'skuPhysical')?.normalizedBusinessMeaning, 'SKU SIM (metadata only)');
  assert.equal(result.sourceContract.find((entry) => entry.currentCodeMapping === 'wmproductIdPhysical')?.normalizedBusinessMeaning, 'WMID SIM / Top-up');
});

test('HICO GỐC contract audit separates valid duration buckets from operational ambiguity', () => {
  const makeRow = ({ sourceType, productName, day, physicalWmid = '', esimWmid = '', physicalSku = '', esimSku = '' }) => {
    const row = Array(25).fill('');
    row[0] = sourceType; row[1] = productName; row[2] = String(day); row[3] = 'Gói tổng';
    row[4] = '95000'; row[5] = '180000'; row[11] = 'Trung Quốc: China Unicom';
    row[16] = physicalSku; row[17] = esimSku; row[23] = physicalWmid; row[24] = esimWmid;
    return row;
  };
  const values = [
    Array(25).fill('header'),
    makeRow({ sourceType: 'Sim', productName: 'Trung Quốc, 5 ngày, Tổng 3GB', day: 3, physicalWmid: 'wm-cn-t3-5d', physicalSku: 'SKU-3D' }),
    makeRow({ sourceType: 'Sim', productName: 'Trung Quốc, 5 ngày, Tổng 3GB', day: 5, physicalWmid: 'wm-cn-t3-5d', physicalSku: 'SKU-5D' }),
    makeRow({ sourceType: 'eSim', productName: 'Trung Quốc, 500MB/ngày', day: 11, esimWmid: 'wm-e-cn-500mb-15d', esimSku: 'SKU-E-11D' }),
    makeRow({ sourceType: 'eSim', productName: 'Trung Quốc, 500MB/ngày', day: 12, esimWmid: 'wm-e-cn-500mb-15d', esimSku: 'SKU-E-12D' }),
  ];
  const result = auditHicoGocValues(values);
  assert.equal(result.topupMultiDayWmidGroups, 1);
  assert.equal(result.durationBucketGroups, 1);
  assert.equal(result.operationalWmidAmbiguities, 0);
  assert.equal(result.sourceOperationCounts.topup, 2);
  assert.equal(result.sourceOperationCounts.new_subscription, 2);
});
