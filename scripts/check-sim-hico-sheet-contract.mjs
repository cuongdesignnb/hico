import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const parser = fs.readFileSync(path.join(root, 'server/catalog/sheetSync/sheetRowParser.js'), 'utf8');
const matcher = fs.readFileSync(path.join(root, 'server/catalog/sheetSync/sheetVariantMatcher.js'), 'utf8');
const identityResolver = fs.readFileSync(path.join(root, 'server/catalog/variantAliases/variantIdentityResolver.js'), 'utf8');
const aliases = fs.readFileSync(path.join(root, 'server/catalog/sheetSync/simHicoHeaderAliases.js'), 'utf8');
const failures = [];
if (!parser.includes('validateSimHicoHeader') || !parser.includes('sourceMedium')) failures.push('native dual-candidate parser is missing');
if (!parser.includes('skuEsim') || !parser.includes('skuPhysical')) failures.push('native SKU aliases are missing');
if (!parser.includes('priceEsim') || !parser.includes('pricePhysical')) failures.push('native price aliases are missing');
if (!(matcher + identityResolver).includes('data.medium') || !/(normalizeSku|normalizeExternalKey)/.test(matcher + identityResolver)) failures.push('matcher is not SKU plus medium based');
if (/variant\.wmproductId\s*===|wmproductId\s*===\s*data\.sku/.test(matcher + identityResolver)) failures.push('WMID appears to be used as a variant key');
if (/cells\[\s*\d+\s*\]/.test(parser)) failures.push('parser contains hard-coded column indexes');
if (!aliases.includes('replace(/[\\r\\n]+/g')) failures.push('header newline normalization is missing');
if (/google\.drive\s*\(|drive\.files\.(?:list|get)|values\.(?:update|append|batchUpdate)\s*\(/i.test(`${parser}\n${matcher}\n${aliases}`)) failures.push('native parser path contains forbidden external API usage');
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('Sim HICO sheet contract scanner passed.');
