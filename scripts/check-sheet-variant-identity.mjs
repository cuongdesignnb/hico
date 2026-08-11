import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.resolve(file), 'utf8');
const matcher = read('server/catalog/variantAliases/variantIdentityResolver.js');
const migration = read('server/migrations/015_catalog_variant_external_aliases.sql');
const router = read('server/catalog/variantAliases/variantAliasRouter.js');
const service = read('server/catalog/variantAliases/variantAliasService.js');
const failures = [];
if (!matcher.includes('MATCHED_ALIAS') || !matcher.includes('IDENTITY_CONFLICT')) failures.push('resolver does not enforce canonical-first alias conflict handling');
if (/wmproductId\s*===|wmproductId\s*:\s*variant\.id|sheetRowNumber\s*===/.test(matcher)) failures.push('WMID or Sheet row appears to be a runtime variant key');
if (matcher.includes('fuzzy') || /includes\(.*sku|startsWith\(.*sku/i.test(matcher)) failures.push('fuzzy SKU matching is present');
if (!/(catalog_variant_external_aliases_(?:active_)?key)/.test(migration) || !migration.includes('normalized_external_key')) failures.push('unique normalized alias constraint is missing');
if (!router.includes('catalog/sheet-reconciliation') || !router.includes('catalog/variant-aliases')) failures.push('reconciliation API routes are missing');
if (!service.includes('canonicalCandidates') || !service.includes('RECONCILIATION_CONFLICT')) failures.push('admin evidence/candidate report is incomplete');
if (service.includes('raw_data') || service.includes('private_key') || service.includes('access_token')) failures.push('reconciliation report contains forbidden raw secret fields');
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; } else console.log('Sheet variant identity scanner passed.');
