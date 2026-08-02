import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateProviderOffers } from './providerOfferValidation.js';

const defaultOffersFile = fileURLToPath(
  new URL('../uploads/provider_offers.json', import.meta.url),
);

const parseOffers = (content) => {
  const offers = JSON.parse(content);
  return validateProviderOffers(offers);
};

const sameProviderData = (current, incoming) => (
  current.rawHash
  && incoming.rawHash
  && current.rawHash === incoming.rawHash
);

export const createProviderOfferRepository = ({
  offersFile = defaultOffersFile,
} = {}) => {
  const readOffers = async () => {
    try {
      return parseOffers(await readFile(offersFile, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  };

  const writeOffers = async (offers) => {
    validateProviderOffers(offers);
    await mkdir(path.dirname(offersFile), { recursive: true });

    const tempFile = `${offersFile}.${process.pid}.${Date.now()}.tmp`;
    const handle = await open(tempFile, 'wx');

    try {
      await handle.writeFile(`${JSON.stringify(offers, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      await rename(tempFile, offersFile);
    } catch (error) {
      await handle.close().catch(() => undefined);
      await unlink(tempFile).catch(() => undefined);
      throw error;
    }
  };

  return {
    async listOffers() {
      return readOffers();
    },

    async getOfferById(offerId) {
      const offers = await readOffers();
      return offers.find((offer) => offer.id === offerId) ?? null;
    },

    async replaceFromSync(incomingOffers, syncedAt) {
      validateProviderOffers(incomingOffers);
      const existingOffers = await readOffers();
      const existingById = new Map(
        existingOffers.map((offer) => [offer.id, offer]),
      );
      const incomingIds = new Set(incomingOffers.map((offer) => offer.id));

      let created = 0;
      let updated = 0;
      let unchanged = 0;
      let deactivated = 0;

      const nextOffers = incomingOffers.map((incoming) => {
        const existing = existingById.get(incoming.id);

        if (!existing) {
          created += 1;
          return incoming;
        }

        if (sameProviderData(existing, incoming) && existing.active) {
          unchanged += 1;
        } else {
          updated += 1;
        }

        return {
          ...incoming,
          syncedAt,
        };
      });

      for (const existing of existingOffers) {
        if (incomingIds.has(existing.id)) {
          continue;
        }

        if (existing.active) {
          deactivated += 1;
          nextOffers.push({
            ...existing,
            active: false,
            syncedAt,
          });
        } else {
          nextOffers.push(existing);
        }
      }

      await writeOffers(nextOffers);

      return {
        created,
        updated,
        unchanged,
        deactivated,
        syncedAt,
      };
    },
  };
};
