import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import {
  checksumCatalog,
  checksumRecords,
} from '../canonical/canonicalCatalogChecksum.js';
import { assertCanonicalCatalog } from '../canonical/canonicalCatalogValidation.js';
import {
  atomicWriteJson,
  defaultUploadsDirectory,
  readJson,
  serializeJson,
} from './catalogWritePersistence.js';
import { CatalogWriteError } from './catalogWriteValidation.js';
import { invalidateCatalogReadCache } from '../read/catalogReadCache.js';
import { cloneSeedCategories } from '../categories/catalogCategories.js';

const VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const durableWrite = async (filePath, content) => {
  const handle = await open(filePath, 'wx');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
};

const normalizeManifest = (manifest) => ({
  ...manifest,
  versionId: manifest.versionId ?? manifest.migrationId,
  migrationId: manifest.migrationId ?? manifest.versionId,
});

export const createCatalogVersionCommitService = ({
  uploadsDirectory = defaultUploadsDirectory,
  failureInjector = async () => undefined,
  logger = console,
  onCommit = async () => undefined,
} = {}) => {
  const versionsDirectory = path.join(uploadsDirectory, 'catalog_versions');
  const currentFile = path.join(uploadsDirectory, 'catalog_current.json');
  const productsMirrorFile = path.join(uploadsDirectory, 'catalog_products.json');
  const variantsMirrorFile = path.join(uploadsDirectory, 'catalog_variants.json');
  const categoriesMirrorFile = path.join(uploadsDirectory, 'catalog_categories.json');

  const safeVersionDirectory = (versionId) => {
    if (!VERSION_PATTERN.test(versionId)) {
      throw new CatalogWriteError('versionId không hợp lệ.');
    }
    return path.join(versionsDirectory, versionId);
  };

  const readVersion = async (versionId) => {
    const directory = safeVersionDirectory(versionId);
    try {
      const manifest = await readJson(path.join(directory, 'manifest.json'));
      const [products, variants, categories] = await Promise.all([
        readJson(path.join(directory, 'catalog_products.json')),
        readJson(path.join(directory, 'catalog_variants.json')),
        manifest.categoriesFile
          ? readJson(path.join(directory, 'catalog_categories.json'))
          : Promise.resolve(cloneSeedCategories()),
      ]);
      const normalized = normalizeManifest(manifest);
      if (
        checksumRecords(products) !== normalized.productsChecksum
        || checksumRecords(variants) !== normalized.variantsChecksum
        || (normalized.categoriesChecksum
          && checksumRecords(categories) !== normalized.categoriesChecksum)
      ) {
        throw new CatalogWriteError(
          'Checksum của catalog version không hợp lệ.',
          { status: 422, code: 'VERSION_CHECKSUM_INVALID' },
        );
      }
      assertCanonicalCatalog({ products, variants, categories });
      return { manifest: normalized, products, variants, categories };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new CatalogWriteError('Không tìm thấy catalog version.', {
          status: 404,
          code: 'VERSION_NOT_FOUND',
        });
      }
      throw error;
    }
  };

  return {
    readVersion,

    async listVersions() {
      try {
        const entries = await readdir(versionsDirectory, {
          withFileTypes: true,
        });
        const manifests = [];
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
          try {
            const manifest = normalizeManifest(await readJson(
              path.join(versionsDirectory, entry.name, 'manifest.json'),
            ));
            manifests.push(manifest);
          } catch (error) {
            logger.warn('[catalog-write] Invalid version manifest skipped.');
          }
        }
        return manifests.sort(
          (left, right) => right.createdAt.localeCompare(left.createdAt),
        );
      } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
      }
    },

    async commit({
      versionId,
      parentVersionId,
      products,
      variants,
      categories = cloneSeedCategories(),
      commandType,
      commandId,
      requestHash,
      createdAt,
      providerOffers,
      manualQrs,
      beforePointer = async () => undefined,
      rollbackBeforePointer = async () => undefined,
    }) {
      assertCanonicalCatalog({
        products,
        variants,
        categories,
        providerOffers,
        manualQrs,
      });
      const checksums = checksumCatalog({ products, variants, categories });
      const finalDirectory = safeVersionDirectory(versionId);
      const stageDirectory = path.join(
        versionsDirectory,
        `.${versionId}.${process.pid}.${Date.now()}.tmp`,
      );
      const productsContent = serializeJson(products);
      const variantsContent = serializeJson(variants);
      const categoriesContent = serializeJson(categories);
      const manifest = {
        schemaVersion: 2,
        versionId,
        migrationId: versionId,
        parentVersionId,
        productsFile: `catalog_versions/${versionId}/catalog_products.json`,
        variantsFile: `catalog_versions/${versionId}/catalog_variants.json`,
        categoriesFile: `catalog_versions/${versionId}/catalog_categories.json`,
        ...checksums,
        commandType,
        commandId,
        requestHash,
        createdAt,
      };
      let renamed = false;
      let beforePointerApplied = false;

      await mkdir(stageDirectory, { recursive: true });
      try {
        await failureInjector('products');
        await durableWrite(
          path.join(stageDirectory, 'catalog_products.json'),
          productsContent,
        );
        await failureInjector('variants');
        await durableWrite(
          path.join(stageDirectory, 'catalog_variants.json'),
          variantsContent,
        );
        await failureInjector('categories');
        await durableWrite(
          path.join(stageDirectory, 'catalog_categories.json'),
          categoriesContent,
        );
        await failureInjector('manifest');
        await durableWrite(
          path.join(stageDirectory, 'manifest.json'),
          serializeJson(manifest),
        );

        const [writtenProducts, writtenVariants, writtenCategories] = await Promise.all([
          JSON.parse(await readFile(
            path.join(stageDirectory, 'catalog_products.json'),
            'utf8',
          )),
          JSON.parse(await readFile(
            path.join(stageDirectory, 'catalog_variants.json'),
            'utf8',
          )),
          JSON.parse(await readFile(
            path.join(stageDirectory, 'catalog_categories.json'),
            'utf8',
          )),
        ]);
        if (
          checksumRecords(writtenProducts) !== manifest.productsChecksum
          || checksumRecords(writtenVariants) !== manifest.variantsChecksum
          || checksumRecords(writtenCategories) !== manifest.categoriesChecksum
        ) {
          throw new Error('Staged catalog checksum verification failed.');
        }

        try {
          await stat(finalDirectory);
          throw new CatalogWriteError('Catalog version đã tồn tại.', {
            status: 409,
            code: 'VERSION_CONFLICT',
          });
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
        await rename(stageDirectory, finalDirectory);
        renamed = true;

        beforePointerApplied = true;
        await beforePointer();
        await failureInjector('pointer');
        await atomicWriteJson(currentFile, manifest);
        invalidateCatalogReadCache(uploadsDirectory);
        try {
          await onCommit({ manifest });
        } catch {
          logger.warn('[catalog-write] Health cache invalidation callback failed.');
        }
      } catch (error) {
        if (beforePointerApplied) {
          await rollbackBeforePointer().catch(() => undefined);
        }
        await rm(stageDirectory, { recursive: true, force: true })
          .catch(() => undefined);
        if (renamed) {
          await rm(finalDirectory, { recursive: true, force: true })
            .catch(() => undefined);
        }
        throw error;
      }

      const warnings = [];
      try {
        await failureInjector('mirrors');
        await Promise.all([
          atomicWriteJson(productsMirrorFile, products),
          atomicWriteJson(variantsMirrorFile, variants),
          atomicWriteJson(categoriesMirrorFile, categories),
        ]);
      } catch (error) {
        warnings.push({
          code: 'MIRROR_UPDATE_FAILED',
          message: 'Compatibility mirror chưa được cập nhật.',
        });
        logger.warn('[catalog-write] Compatibility mirror update failed.');
      }

      return { manifest, warnings };
    },
  };
};
