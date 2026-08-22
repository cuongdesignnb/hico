import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../../database/postgresPool.js';
import { sessionStoreDriver } from '../../auth/session/sessionStore.js';
import { createGoogleSheetSettingsRepository, createUnavailableGoogleSheetSettingsRepository } from '../../integrations/googleSheets/googleSheetSettingsRepository.js';
import { createGoogleSheetCredentialRepository } from '../../integrations/googleSheets/googleSheetCredentialRepository.js';
import { createGoogleSheetClientFactory } from '../../integrations/googleSheets/googleSheetClientFactory.js';
import { createGoogleSheetConnectionService } from '../../integrations/googleSheets/googleSheetConnectionService.js';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { createProviderOfferRepository } from '../../providers/providerOfferRepository.js';
import { createMediaAssetRepository } from '../../media/mediaAssetRepository.js';
import { createSheetSyncRepository } from './sheetSyncRepository.js';
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

export const createCatalogPreviewServices = () => {
  const canonicalRepository = createCanonicalCatalogRepository({ uploadsDirectory });
  const providerRepository = createProviderOfferRepository({ offersFile: path.join(uploadsDirectory, 'provider_offers.json') });
  const mediaAssetRepository = createMediaAssetRepository({ uploadsDirectory });
  const authPool = sessionStoreDriver(process.env) === 'postgres' ? createPostgresPool({ env: process.env }) : null;
  const settingsRepository = authPool ? createGoogleSheetSettingsRepository({ pool: authPool }) : createUnavailableGoogleSheetSettingsRepository();
  const credentialRepository = createGoogleSheetCredentialRepository({ settingsRepository, env: process.env });
  const connectionService = createGoogleSheetConnectionService({
    settingsRepository,
    credentialRepository,
    clientFactory: createGoogleSheetClientFactory(),
    env: process.env,
  });
  const sheetSyncRepository = createSheetSyncRepository({ pool: authPool });
  const variantAliasRepository = createVariantAliasRepository({ pool: authPool });
  const fulfillmentProfileRepository = createFulfillmentProfileRepository({ pool: authPool });
  const commitService = createCatalogVersionCommitService({ uploadsDirectory });
  const commandService = createCatalogCommandService({ env: process.env });
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
  return { sheetSyncService, resyncService, authPool };
};
