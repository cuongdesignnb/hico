import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditHicoGocValues } from '../catalog/sheetSync/hicoGocContractAudit.js';
import { runHicoGocFullSyncAudit, safeAuditError } from './auditHicoGocFullSync.js';

const fixtureArgument = (args) => {
  const index = args.indexOf('--fixture');
  return index >= 0 ? args[index + 1] : null;
};

export const auditMain = async ({ args = process.argv.slice(2), env = process.env, write = (value) => process.stdout.write(value) } = {}) => {
  try {
    const fixture = fixtureArgument(args);
    if (fixture) {
      const parsed = JSON.parse(await fs.readFile(path.resolve(fixture), 'utf8'));
      const values = Array.isArray(parsed) ? parsed : parsed.values;
      write(`${JSON.stringify({ status: 'ok', source: 'fixture', audit: auditHicoGocValues(values), readOnly: true }, null, 2)}\n`);
      return 0;
    }
    const result = await runHicoGocFullSyncAudit({ env });
    write(`${JSON.stringify({ ...result, readOnly: true, sourceContract: { ...result.candidate, parser: result.parser } }, null, 2)}\n`);
    return 0;
  } catch (error) {
    write(`${JSON.stringify({ ...safeAuditError(error), readOnly: true }, null, 2)}\n`);
    return 1;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await auditMain();
