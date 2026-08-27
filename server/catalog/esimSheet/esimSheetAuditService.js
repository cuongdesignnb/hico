import { assertSimHicoReference, auditEsimSheetRows } from './esimSheetSource.js';
import { createEsimSheetReferenceClient } from './esimSheetReferenceClient.js';

export const createEsimSheetAuditService = ({ env = process.env, referenceClient = createEsimSheetReferenceClient({ env }), providerRepository } = {}) => ({
  async audit({ mapping = {} } = {}) {
    const reference = assertSimHicoReference(await referenceClient.readRows());
    const providerOffers = providerRepository?.listOffers ? await providerRepository.listOffers() : [];
    return auditEsimSheetRows({ values: reference.values, mapping, providerOffers });
  },
});
