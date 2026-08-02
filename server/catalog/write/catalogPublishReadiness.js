import { normalizeSku } from '../canonical/canonicalSkuConflicts.js';
import { validateProductRecord } from './catalogProductValidation.js';
import { validateVariantRecord } from './catalogVariantValidation.js';

const uniqueErrors = (errors) => {
  const seen = new Set();
  return errors.filter((error) => {
    const key = `${error.code}:${error.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const getVariantPublishReadiness = ({
  variant,
  product,
  products,
  variants,
  providerOffers,
}) => {
  const validation = validateVariantRecord({
    variant,
    product,
    providerOffers,
  });
  const errors = [...validation.errors];

  if (variant.archived) {
    errors.push({ code: 'VARIANT_ARCHIVED', message: 'Variant đã được archive.' });
  }
  if (variant.needsReview) {
    errors.push({
      code: 'NEEDS_REVIEW',
      message: 'Variant đang cần Admin review.',
    });
  }
  if (variant.skuConflict) {
    errors.push({ code: 'SKU_CONFLICT', message: 'SKU đang bị trùng.' });
  }
  const matchingSku = variants.filter(
    (item) => normalizeSku(item.sku) === normalizeSku(variant.sku),
  );
  if (matchingSku.length > 1) {
    errors.push({ code: 'SKU_CONFLICT', message: 'SKU đang bị trùng.' });
  }
  if (!products.some((item) => item.id === variant.productId)) {
    errors.push({
      code: 'PRODUCT_NOT_FOUND',
      message: 'Product của variant không tồn tại.',
    });
  }

  return {
    publishable: errors.length === 0,
    errors: uniqueErrors(errors),
    warnings: validation.warnings,
  };
};

export const getProductPublishReadiness = ({
  product,
  products,
  variants,
  providerOffers,
}) => {
  const validation = validateProductRecord(product);
  const errors = [...validation.errors];
  const warnings = [...validation.warnings];

  if (product.status === 'archived') {
    errors.push({
      code: 'PRODUCT_ARCHIVED',
      message: 'Product đã được archive.',
    });
  }
  if (products.some(
    (item) => item.id !== product.id && item.slug === product.slug,
  )) {
    errors.push({ code: 'SLUG_CONFLICT', message: 'Slug đang bị trùng.' });
  }

  const productVariants = variants.filter(
    (variant) => variant.productId === product.id && !variant.archived,
  );
  const variantReadiness = productVariants.map((variant) => ({
    variantId: variant.id,
    ...getVariantPublishReadiness({
      variant,
      product,
      products,
      variants,
      providerOffers,
    }),
  }));
  if (!variantReadiness.some((item) => item.publishable)) {
    errors.push({
      code: 'NO_PUBLISHABLE_VARIANT',
      message: 'Product chưa có variant đủ điều kiện publish.',
    });
  }

  return {
    publishable: errors.length === 0,
    errors: uniqueErrors(errors),
    warnings,
    variants: variantReadiness,
  };
};

