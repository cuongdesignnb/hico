const isWrite = (method) => !['GET', 'HEAD', 'OPTIONS'].includes(method);

export const permissionForAdminRequest = (req) => {
  const { method, path } = req;
  if (path.startsWith('/catalog-sheet-sync/')) return 'catalog.sheet_sync';
  if (path.startsWith('/catalog/sheet-reconciliation/')) return isWrite(method) ? 'catalog.sheet.reconcile.write' : 'catalog.sheet.reconcile.read';
  if (path.startsWith('/catalog/variant-aliases/')) return 'catalog.sheet.reconcile.write';
  if (path === '/catalog/variant-aliases') return 'catalog.sheet.reconcile.write';
  if (path.startsWith('/catalog/fulfillment/')) return isWrite(method) ? 'catalog.fulfillment.write' : 'catalog.fulfillment.read';
  if (path.startsWith('/settings/integrations/google-sheet')) {
    if (path.endsWith('/test')) return 'catalog.sheet.settings.test';
    if (path.endsWith('/preview')) return 'catalog.sheet.sync.preview';
    return isWrite(method) ? 'catalog.sheet.settings.write' : 'catalog.sheet.settings.read';
  }
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
  if (path.startsWith('/customers/') && path.endsWith('/loyalty/adjust')) return 'loyalty.adjust';
  if (path.startsWith('/referrals')) return isWrite(method) ? 'referrals.review' : 'referrals.read';
  if (path.startsWith('/support/tickets')) {
    if (path.includes('/internal-notes') || path.includes('/messages')) return 'support.reply';
    if (path.includes('/assign')) return 'support.assign';
    if (path.includes('/status')) return 'support.status';
    return isWrite(method) ? 'support.status' : 'support.read';
  }
  if (path.startsWith('/customers') || path.startsWith('/promos')) return isWrite(method) ? 'admin.users.manage' : 'admin.users.read';
  return 'admin.access';
};
