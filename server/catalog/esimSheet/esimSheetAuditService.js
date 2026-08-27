import { assertSimHicoReference, auditEsimSheetRows } from './esimSheetSource.js';
import { createEsimSheetReferenceClient } from './esimSheetReferenceClient.js';

export const createEsimSheetAuditService = ({ env = process.env, referenceClient = createEsimSheetReferenceClient({ env }), providerRepository, catalogRepository = null } = {}) => ({
  async audit({ mapping = {} } = {}) {
    const reference = assertSimHicoReference(await referenceClient.readRows());
    const providerOffers = providerRepository?.listOffers ? await providerRepository.listOffers() : [];
    const catalog = catalogRepository?.readCatalog ? await catalogRepository.readCatalog({ required: true }) : null;
    return {
      sheetTab: reference.sheetTab ?? null,
      sheetRange: reference.sheetRange ?? null,
      spreadsheetId: reference.spreadsheetId ?? null,
      ...auditEsimSheetRows({ values: reference.values, mapping, providerOffers, existingVariants: catalog?.variants ?? [] }),
    };
  },
});
