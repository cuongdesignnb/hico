import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../../database/postgresPool.js';
import { createGoogleSheetSettingsRepository, createInMemoryGoogleSheetSettingsRepository } from '../../integrations/googleSheets/googleSheetSettingsRepository.js';
import { createGoogleSheetCredentialRepository } from '../../integrations/googleSheets/googleSheetCredentialRepository.js';
import { createGoogleSheetClientFactory } from '../../integrations/googleSheets/googleSheetClientFactory.js';
import { createGoogleSheetConnectionService } from '../../integrations/googleSheets/googleSheetConnectionService.js';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createMediaAssetRepository } from '../../media/mediaAssetRepository.js';
import { assertPostgresSheetSyncStorage, createSheetSyncRepository } from './sheetSyncRepository.js';
import { createSheetSyncService } from './sheetSyncService.js';
import { createCatalogResyncService } from './catalogResyncService.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import { createCatalogAuditRepository } from '../write/catalogAuditRepository.js';
import { createCatalogCommandService } from '../write/catalogCommandService.js';
import { defaultUploadsDirectory } from '../write/catalogWritePersistence.js';
import { createVariantAliasRepository } from '../variantAliases/variantAliasRepository.js';
import { createFulfillmentProfileRepository } from '../fulfillment/fulfillmentProfileRepository.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.resolve(serverDirectory, '../../uploads');

export const createCatalogPreviewServices = async ({ env = process.env } = {}) => {
  const canonicalRepository = createCanonicalCatalogRepository({ uploadsDirectory });
  const providerRepository = createProviderOfferRepository({ offersFile: path.join(uploadsDirectory, 'provider_offers.json') });
  const mediaAssetRepository = createMediaAssetRepository({ uploadsDirectory });
  const previewPool = env.DATABASE_URL ? createPostgresPool({ env }) : null;
  if (previewPool) await assertPostgresSheetSyncStorage({ pool: previewPool });
  const settingsRepository = previewPool
    ? createGoogleSheetSettingsRepository({ pool: previewPool })
    : createInMemoryGoogleSheetSettingsRepository({ initial: {
      enabled: Boolean(env.CATALOG_SHEET_ID && env.CATALOG_SHEET_TAB && env.CATALOG_SHEET_RANGE),
      spreadsheetId: env.CATALOG_SHEET_ID ?? null,
      sheetName: env.CATALOG_SHEET_TAB ?? null,
      sheetRange: env.CATALOG_SHEET_RANGE ?? null,
    } });
  const credentialRepository = createGoogleSheetCredentialRepository({ settingsRepository, env });
  const connectionService = createGoogleSheetConnectionService({
    settingsRepository,
    credentialRepository,
    clientFactory: createGoogleSheetClientFactory(),
    env,
  });
  const sheetSyncRepository = createSheetSyncRepository({ pool: previewPool });
  const variantAliasRepository = createVariantAliasRepository({ pool: previewPool });
  const fulfillmentProfileRepository = createFulfillmentProfileRepository({ pool: previewPool });
  const commitService = createCatalogVersionCommitService({ uploadsDirectory });
  const commandService = createCatalogCommandService({ env });
  const auditRepository = createCatalogAuditRepository({ uploadsDirectory });
  const sheetSyncService = createSheetSyncService({
    repository: sheetSyncRepository,
    referenceClient: { readRows: () => connectionService.readRows() },
    canonicalRepository,
    providerRepository,
    fulfillmentProfileRepository,
    commitService,
    variantAliasRepository,
  });
  const resyncService = createCatalogResyncService({
    repository: sheetSyncRepository,
    referenceClient: { readRows: () => connectionService.readRows() },
    canonicalRepository,
    commitService,
    auditRepository,
    providerRepository,
    commandService,
    mediaAssetRepository,
    uploadsDirectory: defaultUploadsDirectory,
  });
  return { sheetSyncService, resyncService, previewPool };
};
