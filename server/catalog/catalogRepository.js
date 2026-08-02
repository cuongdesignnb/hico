import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const defaultUploadsDirectory = fileURLToPath(new URL('../uploads/', import.meta.url));

const readJsonArray = async (filePath) => {
  const content = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected an array in ${path.basename(filePath)}`);
  }

  return parsed;
};

export const createCatalogRepository = ({
  uploadsDirectory = defaultUploadsDirectory,
} = {}) => ({
  async readLegacyCatalog() {
    const [destinations, packages] = await Promise.all([
      readJsonArray(path.join(uploadsDirectory, 'destinations.json')),
      readJsonArray(path.join(uploadsDirectory, 'packages.json')),
    ]);

    return { destinations, packages };
  },
});
