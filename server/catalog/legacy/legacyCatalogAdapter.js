import { adaptLegacyDestination } from './legacyDestinationAdapter.js';
import { adaptLegacyPackage } from './legacyPackageAdapter.js';

const classifyProduct = (product) => {
  if (product.operation === 'topup' || product.operation === 'device_sale') {
    return {
      type: null,
      unsupported: {
        productId: product.id,
        operation: product.operation,
        reason: 'Product operation is not supported by legacy destinations/packages.',
      },
    };
  }

  const sourceType = product.legacySource === 'destination'
    ? 'destination'
    : product.legacySource === 'package'
      ? 'package'
      : null;
  const coverageType = product.coverageType === 'country'
    ? 'destination'
    : product.coverageType === 'region' || product.coverageType === 'global'
      ? 'package'
      : null;

  if (sourceType && coverageType && sourceType !== coverageType) {
    return {
      type: null,
      conflict: {
        productId: product.id,
        legacySource: product.legacySource,
        coverageType: product.coverageType,
      },
    };
  }

  const type = sourceType ?? coverageType;
  if (
    type === 'destination'
    && Array.isArray(product.coverageIds)
    && product.coverageIds.length !== 1
  ) {
    return {
      type: null,
      conflict: {
        productId: product.id,
        legacySource: product.legacySource,
        coverageType: product.coverageType,
        coverageIds: product.coverageIds,
      },
    };
  }
  const projectedIconType = product.legacyProjection?.iconType;
  if (
    type === 'package'
    && projectedIconType
    && (
      (product.coverageType === 'global' && projectedIconType !== 'global')
      || (product.coverageType === 'region' && projectedIconType !== 'region')
    )
  ) {
    return {
      type: null,
      conflict: {
        productId: product.id,
        legacySource: product.legacySource,
        coverageType: product.coverageType,
        iconType: projectedIconType,
      },
    };
  }
  if (!type) {
    return {
      type: null,
      unsupported: {
        productId: product.id,
        operation: product.operation,
        coverageType: product.coverageType,
        reason: 'Product cannot be safely classified for legacy projection.',
      },
    };
  }
  return { type };
};

export const adaptCanonicalToLegacy = ({ products, variants }) => {
  const variantsByProduct = new Map();
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.productId) ?? [];
    list.push(variant);
    variantsByProduct.set(variant.productId, list);
  }

  const destinations = [];
  const packages = [];
  const unsupportedLegacyProjection = [];
  const classificationConflicts = [];

  for (const product of products) {
    if (!product.legacySource && product.status !== 'active') {
      continue;
    }
    const classification = classifyProduct(product);
    if (classification.conflict) {
      classificationConflicts.push(classification.conflict);
      continue;
    }
    if (classification.unsupported) {
      unsupportedLegacyProjection.push(classification.unsupported);
      continue;
    }

    const productVariants = variantsByProduct.get(product.id) ?? [];
    const adapted = classification.type === 'destination'
      ? adaptLegacyDestination(product, productVariants)
      : adaptLegacyPackage(product, productVariants);
    unsupportedLegacyProjection.push(...adapted.unsupported);

    if (adapted.unsupported.length > 0) {
      unsupportedLegacyProjection.push({
        productId: product.id,
        reason: 'Product contains variants unsupported by legacy projection.',
      });
      continue;
    }

    if (classification.type === 'destination') destinations.push(adapted.item);
    else packages.push(adapted.item);
  }

  return {
    destinations,
    packages,
    diagnostics: {
      unsupportedLegacyProjection,
      classificationConflicts,
    },
  };
};
