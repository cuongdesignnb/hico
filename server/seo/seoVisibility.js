const hasText = (value) => typeof value === 'string' && value.trim() !== '';

export const isPublicVariant = (variant) => Boolean(
  variant
  && variant.active === true
  && variant.archived !== true
  && variant.needsReview !== true
  && variant.skuConflict !== true,
);

export const getSeoVisibility = (product, variants = []) => {
  const reasons = [];
  if (product?.status !== 'active') reasons.push('PRODUCT_NOT_ACTIVE');
  if (!hasText(product?.slug)) reasons.push('PRODUCT_SLUG_MISSING');
  if (!variants.some(isPublicVariant)) reasons.push('NO_PUBLIC_VARIANT');
  return {
    public: reasons.length === 0,
    indexable: reasons.length === 0,
    reasons,
  };
};

export const isPublicArticle = (article, now = new Date()) => {
  if (!article || article.status === 'draft') return false;
  if (article.status === 'scheduled') return Boolean(article.scheduledDate) && Date.parse(article.scheduledDate) <= now.getTime();
  return true;
};
