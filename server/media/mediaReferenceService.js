import { readFile } from 'node:fs/promises';
import path from 'node:path';

const readJson = async (filePath) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    return null;
  }
};

const walk = (value, needle, currentPath = '$', findings = []) => {
  if (findings.length >= 20 || value === null || value === undefined) return findings;
  if (typeof value === 'string') {
    if (value === needle) findings.push(currentPath);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, needle, `${currentPath}.${index}`, findings));
    return findings;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => walk(item, needle, `${currentPath}.${key}`, findings));
  }
  return findings;
};

export const createMediaReferenceService = ({ uploadsDirectory, canonicalRepository }) => ({
  async findReferences(asset) {
    const sources = [];
    try {
      const catalog = await canonicalRepository.readCatalog({ required: true });
      sources.push(['canonical-products', catalog.products], ['canonical-variants', catalog.variants]);
    } catch {
      // A missing canonical catalog must not make the delete endpoint expose a stack trace.
    }
    for (const filename of ['destinations.json', 'packages.json', 'devices.json', 'articles.json', 'promos.json']) {
      sources.push([filename, await readJson(path.join(uploadsDirectory, filename))]);
    }
    return sources.flatMap(([source, value]) => walk(value, asset.id).concat(walk(value, asset.publicUrl)).map((referencePath) => ({ source, path: referencePath })))
      .slice(0, 20);
  },
});
