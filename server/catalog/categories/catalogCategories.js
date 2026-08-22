const SEED_TIMESTAMP = '2026-08-15T00:00:00.000Z';

export const CATEGORY_KINDS = Object.freeze([
  'esim',
  'physical_sim',
  'topup',
  'device',
  'accessory',
]);

export const CATEGORY_STATUSES = Object.freeze(['active', 'archived']);

const seed = (record) => Object.freeze({
  sortOrder: 0,
  status: 'active',
  version: 1,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
  ...record,
});

export const SEED_CATEGORIES = Object.freeze([
  seed({ id: 'cat-sim-esim', slug: 'sim-esim', name: 'SIM & eSIM', parentId: null, kind: null, sortOrder: 10 }),
  seed({ id: 'cat-esim-du-lich', slug: 'esim-du-lich', name: 'eSIM du lịch', parentId: 'cat-sim-esim', kind: 'esim', sortOrder: 10 }),
  seed({ id: 'cat-sim-vat-ly', slug: 'sim-vat-ly', name: 'SIM vật lý', parentId: 'cat-sim-esim', kind: 'physical_sim', sortOrder: 20 }),
  seed({ id: 'cat-esim-san-goi', slug: 'esim-san-goi', name: 'eSIM sẵn gói', parentId: 'cat-sim-esim', kind: 'esim', sortOrder: 30 }),
  seed({ id: 'cat-sim-vat-ly-san-goi', slug: 'sim-vat-ly-san-goi', name: 'SIM vật lý sẵn gói', parentId: 'cat-sim-esim', kind: 'physical_sim', sortOrder: 40 }),
  seed({ id: 'cat-esim-co-goi', slug: 'esim-co-goi', name: 'eSIM có gọi', parentId: 'cat-sim-esim', kind: 'esim', sortOrder: 50 }),
  seed({ id: 'cat-sim-vat-ly-co-goi', slug: 'sim-vat-ly-co-goi', name: 'SIM vật lý có gọi', parentId: 'cat-sim-esim', kind: 'physical_sim', sortOrder: 60 }),
  seed({ id: 'cat-sim-viet-nam', slug: 'sim-viet-nam', name: 'SIM Việt Nam', parentId: 'cat-sim-esim', kind: 'physical_sim', sortOrder: 70 }),
  seed({ id: 'cat-dich-vu', slug: 'dich-vu', name: 'Dịch vụ', parentId: null, kind: null, sortOrder: 20 }),
  seed({ id: 'cat-nap-them', slug: 'nap-them', name: 'Nạp thêm', parentId: 'cat-dich-vu', kind: 'topup', sortOrder: 10 }),
  seed({ id: 'cat-thiet-bi', slug: 'thiet-bi', name: 'Thiết bị', parentId: null, kind: null, sortOrder: 30 }),
  seed({ id: 'cat-bo-phat-wifi', slug: 'bo-phat-wifi', name: 'Bộ phát WiFi', parentId: 'cat-thiet-bi', kind: 'device', sortOrder: 10 }),
  seed({ id: 'cat-phu-kien', slug: 'phu-kien', name: 'Phụ kiện', parentId: 'cat-thiet-bi', kind: 'accessory', sortOrder: 20 }),
]);

export const cloneSeedCategories = () => SEED_CATEGORIES.map((category) => ({ ...category }));

export const mergeCatalogCategories = (currentCategories = [], seedCategories = SEED_CATEGORIES) => {
  const current = Array.isArray(currentCategories) ? currentCategories.map((category) => ({ ...category })) : [];
  const ids = new Set(current.map((category) => category?.id).filter(Boolean));
  const slugs = new Set(current.map((category) => category?.slug).filter(Boolean));
  for (const category of seedCategories) {
    if (ids.has(category.id) || slugs.has(category.slug)) continue;
    current.push({ ...category });
    ids.add(category.id);
    slugs.add(category.slug);
  }
  return current;
};

export const categoryIdForPackage = (packageClass, medium, operation) => {
  if (operation === 'topup') return 'cat-nap-them';
  if (packageClass === 'STANDARD_TRAVEL') return medium === 'esim' ? 'cat-esim-du-lich' : medium === 'physical_sim' ? 'cat-sim-vat-ly' : null;
  if (packageClass === 'PRELOADED') return medium === 'esim' ? 'cat-esim-san-goi' : medium === 'physical_sim' ? 'cat-sim-vat-ly-san-goi' : null;
  if (packageClass === 'VOICE') return medium === 'esim' ? 'cat-esim-co-goi' : medium === 'physical_sim' ? 'cat-sim-vat-ly-co-goi' : null;
  if (packageClass === 'DOMESTIC_VN') return medium === 'physical_sim' ? 'cat-sim-viet-nam' : null;
  return null;
};

export const operationForCategoryKind = (kind) => {
  if (kind === 'topup') return 'topup';
  if (kind === 'device' || kind === 'accessory') return 'device_sale';
  if (kind === 'esim' || kind === 'physical_sim') return 'new_subscription';
  return null;
};

export const categoryById = (categories, categoryId) => (
  categories.find((category) => category.id === categoryId)
);

export const isLeafCategory = (category, categories) => Boolean(
  category
  && category.parentId
  && category.kind
  && !categories.some((candidate) => candidate.parentId === category.id)
);

export const categoryPath = (categories, categoryId) => {
  const category = categoryById(categories, categoryId);
  if (!category) return [];
  const parent = category.parentId ? categoryById(categories, category.parentId) : null;
  return [parent, category].filter(Boolean).map(({ id, slug, name }) => ({ id, slug, name }));
};

export const categoryFilterIds = (categories, value) => {
  const selected = categories.find((category) => category.id === value || category.slug === value);
  if (!selected) return new Set();
  if (selected.parentId) return new Set([selected.id]);
  return new Set(categories.filter((category) => category.parentId === selected.id).map((category) => category.id));
};

const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const validTimestamp = (value) => nonEmpty(value) && !Number.isNaN(Date.parse(value));

export const validateCategories = (categories) => {
  const errors = [];
  if (!Array.isArray(categories)) return { valid: false, errors: ['Canonical categories must be an array.'] };
  const ids = new Set();
  const slugs = new Set();
  const byId = new Map(categories.map((category) => [category?.id, category]));

  for (const category of categories) {
    const label = `Category ${category?.id ?? '<missing>'}`;
    if (!nonEmpty(category?.id)) errors.push(`${label} has invalid id.`);
    else if (ids.has(category.id)) errors.push(`${label} has duplicate id.`);
    else ids.add(category.id);
    if (!nonEmpty(category?.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug)) errors.push(`${label} has invalid slug.`);
    else if (slugs.has(category.slug)) errors.push(`${label} has duplicate slug.`);
    else slugs.add(category.slug);
    if (!nonEmpty(category?.name)) errors.push(`${label} has invalid name.`);
    if (!CATEGORY_STATUSES.includes(category?.status)) errors.push(`${label} has invalid status.`);
    if (!Number.isInteger(category?.sortOrder) || category.sortOrder < 0) errors.push(`${label} has invalid sortOrder.`);
    if (!Number.isInteger(category?.version) || category.version < 1) errors.push(`${label} has invalid version.`);
    if (!validTimestamp(category?.createdAt) || !validTimestamp(category?.updatedAt)) errors.push(`${label} has invalid timestamps.`);

    if (category?.parentId === null) {
      if (category.kind !== null) errors.push(`${label} root must not define kind.`);
    } else {
      const parent = byId.get(category?.parentId);
      if (!parent) errors.push(`${label} references a missing parent.`);
      else if (parent.parentId !== null) errors.push(`${label} exceeds the two-level category limit.`);
      if (!CATEGORY_KINDS.includes(category?.kind)) errors.push(`${label} has invalid kind.`);
    }
  }

  for (const category of categories) {
    if (category.parentId && categories.some((candidate) => candidate.parentId === category.id)) {
      errors.push(`Category ${category.id} cannot be both a leaf and a parent.`);
    }
  }
  return { valid: errors.length === 0, errors };
};

const hasDeviceSpecifications = (product) => {
  const specs = product?.deviceSpecifications ?? product?.deviceSpecs;
  return Boolean(specs && typeof specs === 'object' && Object.values(specs).some((value) => (
    Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== ''
  )));
};

export const inferCategoryId = (product, variants = []) => {
  if (product?.operation === 'topup') return 'cat-nap-them';
  if (hasDeviceSpecifications(product)) return 'cat-bo-phat-wifi';
  if (product?.operation !== 'new_subscription') return null;
  const media = new Set(variants.filter((variant) => variant.productId === product.id).map((variant) => variant.medium).filter(Boolean));
  if (media.size === 1 && media.has('esim')) return 'cat-esim-du-lich';
  if (media.size === 1 && media.has('physical_sim')) return 'cat-sim-vat-ly';
  return null;
};

export const projectProductCategory = (product, variants, categories) => {
  const categoryId = product.categoryId ?? inferCategoryId(product, variants);
  const category = categoryById(categories, categoryId);
  return {
    ...product,
    ...(category ? { categoryId: category.id, categoryPath: categoryPath(categories, category.id) } : {}),
    categoryNeedsReview: !category || product.categoryNeedsReview === true,
  };
};

export const backfillProductCategories = ({ products, variants, now }) => {
  const report = { assigned: 0, unresolved: 0, unchanged: 0, assignments: [] };
  const nextProducts = products.map((product) => {
    if (product.categoryId) {
      report.unchanged += 1;
      return product;
    }
    const categoryId = inferCategoryId(product, variants);
    if (!categoryId) {
      report.unresolved += 1;
      if (product.categoryNeedsReview === true) return product;
      return { ...product, categoryNeedsReview: true, version: product.version + 1, updatedAt: now };
    }
    report.assigned += 1;
    report.assignments.push({ productId: product.id, categoryId });
    return {
      ...product,
      categoryId,
      categoryNeedsReview: false,
      version: product.version + 1,
      updatedAt: now,
    };
  });
  return { products: nextProducts, report };
};
