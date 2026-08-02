import { importLegacyOrders } from './migrateOrderOwnership.js';

const result = await importLegacyOrders({ dryRun: !process.argv.includes('--write') });
console.log(JSON.stringify(result));
