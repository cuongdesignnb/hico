const isWrite = (method) => !['GET', 'HEAD', 'OPTIONS'].includes(method);

export const permissionForAdminRequest = (req) => {
  const { method, path } = req;
  if (path.startsWith('/providers/')) return method === 'POST' ? 'provider.sync' : 'provider.read';
  if (path.includes('/reconciliation/')) return isWrite(method) ? 'reconciliation.resolve' : 'reconciliation.read';
  if (path.includes('/catalog/bulk/')) return method === 'POST' && path.endsWith('/execute') ? 'catalog.bulk.execute' : 'catalog.product.read';
  if (path.includes('/catalog/versions/') && path.endsWith('/rollback')) return 'catalog.rollback';
  if (path.includes('/catalog/') && /publish|unpublish/.test(path)) return 'catalog.publish';
  if (path.includes('/catalog/')) {
    if (!isWrite(method)) return 'catalog.product.read';
    if (path.includes('/variants/')) return 'catalog.variant.manage';
    if (/archive|restore|delete/.test(path) || method === 'DELETE') return 'catalog.product.archive';
    return method === 'POST' && path.endsWith('/products') ? 'catalog.product.create' : 'catalog.product.update';
  }
  if (path.startsWith('/manual-qrs')) return isWrite(method) ? 'inventory.qr.manage' : 'inventory.qr.read';
  if (path.startsWith('/devices')) return isWrite(method) ? 'inventory.stock.manage' : 'inventory.stock.read';
  if (path.startsWith('/orders') || path.startsWith('/tickets')) return isWrite(method) ? 'orders.update' : 'orders.read';
  if (path.startsWith('/articles') || path.startsWith('/reviews')) return isWrite(method) ? 'articles.manage' : 'articles.read';
  if (path.startsWith('/media')) return method === 'DELETE' ? 'media.delete' : (isWrite(method) ? 'media.upload' : 'media.upload');
  if (path.startsWith('/config')) return isWrite(method) ? 'system.config.manage' : 'system.config.read_masked';
  if (path.startsWith('/users')) return isWrite(method) ? 'admin.users.manage' : 'admin.users.read';
  if (path.startsWith('/customers') || path.startsWith('/promos')) return isWrite(method) ? 'admin.users.manage' : 'admin.users.read';
  return 'admin.access';
};
