import { createCatalogBulkService } from '../bulk/catalogBulkService.js';

export const createCatalogPublishService = ({
  catalogBulkService = createCatalogBulkService(),
} = {}) => ({
  publishProduct(productId, request, actor) {
    return catalogBulkService.publishEntity({
      entityType: 'product',
      id: productId,
      publish: true,
      request,
      actor,
    });
  },

  unpublishProduct(productId, request, actor) {
    return catalogBulkService.publishEntity({
      entityType: 'product',
      id: productId,
      publish: false,
      request,
      actor,
    });
  },

  publishVariant(variantId, request, actor) {
    return catalogBulkService.publishEntity({
      entityType: 'variant',
      id: variantId,
      publish: true,
      request,
      actor,
    });
  },

  unpublishVariant(variantId, request, actor) {
    return catalogBulkService.publishEntity({
      entityType: 'variant',
      id: variantId,
      publish: false,
      request,
      actor,
    });
  },
});
