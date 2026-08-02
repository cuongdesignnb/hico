import { createProviderOfferRepository } from '../providerOfferRepository.js';
import { createWorldmoveClientFromEnv } from './worldmoveClient.js';
import { mapWorldmoveQuotation } from './worldmoveMapper.js';

export const createWorldmoveCatalogService = ({
  repository = createProviderOfferRepository(),
  clientFactory = createWorldmoveClientFromEnv,
  now = () => new Date(),
} = {}) => ({
  async listOffers() {
    return repository.listOffers();
  },

  async getOfferById(offerId) {
    return repository.getOfferById(offerId);
  },

  async syncOffers() {
    const syncedAt = now().toISOString();
    const client = clientFactory();
    const response = await client.fetchQuotation();
    const offers = mapWorldmoveQuotation(response, syncedAt);
    return repository.replaceFromSync(offers, syncedAt);
  },
});
