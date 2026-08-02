import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertCanonicalCatalog } from './canonicalCatalogValidation.js';
import { checksumRecords } from './canonicalCatalogChecksum.js';

const defaultUploadsDirectory = fileURLToPath(
  new URL('../../uploads/', import.meta.url),
);

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const atomicWrite = async (filePath, content) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(tempFile, 'wx');

  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    await rename(tempFile, filePath);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(tempFile, { force: true }).catch(() => undefined);
    throw error;
  }
};

const safeVersionPath = (uploadsDirectory, relativePath) => {
  const resolved = path.resolve(uploadsDirectory, relativePath);
  const versionsRoot = path.resolve(uploadsDirectory, 'catalog_versions');
  if (!resolved.startsWith(`${versionsRoot}${path.sep}`)) {
    throw new Error('Canonical manifest contains an unsafe file path.');
  }
  return resolved;
};

export const createCanonicalCatalogRepository = ({
  uploadsDirectory = defaultUploadsDirectory,
} = {}) => {
  const currentFile = path.join(uploadsDirectory, 'catalog_current.json');
  const productsMirrorFile = path.join(uploadsDirectory, 'catalog_products.json');
  const variantsMirrorFile = path.join(uploadsDirectory, 'catalog_variants.json');
  const versionsDirectory = path.join(uploadsDirectory, 'catalog_versions');
  const reportsDirectory = path.join(uploadsDirectory, 'migration_reports');

  const readCurrentManifest = async () => {
    try {
      return await readJson(currentFile);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  };

  return {
    readCurrentManifest,

    async readCatalog({ required = false } = {}) {
      const manifest = await readCurrentManifest();
      if (!manifest) {
        if (required) throw new Error('Canonical catalog has not been migrated.');
        return { products: [], variants: [], manifest: null };
      }

      const productsFile = safeVersionPath(
        uploadsDirectory,
        manifest.productsFile,
      );
      const variantsFile = safeVersionPath(
        uploadsDirectory,
        manifest.variantsFile,
      );
      const [products, variants] = await Promise.all([
        readJson(productsFile),
        readJson(variantsFile),
      ]);
      if (
        checksumRecords(products) !== manifest.productsChecksum
        || checksumRecords(variants) !== manifest.variantsChecksum
      ) {
        throw new Error('Canonical catalog checksum does not match its manifest.');
      }
      assertCanonicalCatalog({ products, variants });
      return { products, variants, manifest };
    },

    async writeVersion({
      migrationId,
      products,
      variants,
      checksums,
      createdAt,
      providerOffers = [],
      manualQrs = [],
    }) {
      assertCanonicalCatalog({
        products,
        variants,
        providerOffers,
        manualQrs,
      });

      const finalDirectory = path.join(versionsDirectory, migrationId);
      const stageDirectory = path.join(
        versionsDirectory,
        `.${migrationId}.${process.pid}.${Date.now()}.tmp`,
      );
      await mkdir(stageDirectory, { recursive: true });

      const productsContent = serialize(products);
      const variantsContent = serialize(variants);
      const manifest = {
        migrationId,
        productsFile: `catalog_versions/${migrationId}/catalog_products.json`,
        variantsFile: `catalog_versions/${migrationId}/catalog_variants.json`,
        ...checksums,
        createdAt,
      };

      try {
        await Promise.all([
          atomicWrite(
            path.join(stageDirectory, 'catalog_products.json'),
            productsContent,
          ),
          atomicWrite(
            path.join(stageDirectory, 'catalog_variants.json'),
            variantsContent,
          ),
        ]);
        await atomicWrite(
          path.join(stageDirectory, 'manifest.json'),
          serialize(manifest),
        );

        try {
          await stat(finalDirectory);
          throw new Error(`Canonical version already exists: ${migrationId}`);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }

        await rename(stageDirectory, finalDirectory);
        await atomicWrite(currentFile, serialize(manifest));

        // Compatibility mirrors are not authoritative; the pointer above is.
        await Promise.all([
          atomicWrite(productsMirrorFile, productsContent),
          atomicWrite(variantsMirrorFile, variantsContent),
        ]);
        return manifest;
      } catch (error) {
        await rm(stageDirectory, { recursive: true, force: true })
          .catch(() => undefined);
        throw error;
      }
    },

    async writeReport(report) {
      const safeTimestamp = report.completedAt.replace(/[:.]/g, '-');
      const reportFile = path.join(
        reportsDirectory,
        `catalog_migration_${safeTimestamp}.json`,
      );
      await atomicWrite(reportFile, serialize(report));
      return reportFile;
    },

    async findReport(migrationId) {
      try {
        const files = (await readdir(reportsDirectory))
          .filter((name) => name.startsWith('catalog_migration_'))
          .sort()
          .reverse();
        for (const name of files) {
          const report = await readJson(path.join(reportsDirectory, name));
          if (report.migrationId === migrationId) return report;
        }
        return null;
      } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
      }
    },
  };
};
