#!/usr/bin/env node
import { createCatalogMigrationService } from '../catalog/migration/catalogMigrationService.js';

const flags = new Set(process.argv.slice(2));
const write = flags.has('--write');
const validate = flags.has('--validate') || flags.has('--dry-run');

if ((!write && !validate) || (write && validate)) {
  console.error('Usage: node scripts/migrateLegacyCatalog.js --validate|--write');
  process.exitCode = 1;
} else {
  try {
    const service = createCatalogMigrationService();
    const result = write ? await service.run() : await service.validate();
    const {
      report: _report,
      ...summary
    } = result;
    console.log(JSON.stringify(summary, null, 2));
    if (result.valid === false) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 1;
  }
}
