export const ALL_PERMISSIONS = [
  'catalog.product.read', 'catalog.product.create', 'catalog.product.update', 'catalog.product.archive', 'catalog.variant.manage', 'catalog.publish', 'catalog.bulk.execute', 'catalog.rollback', 'catalog.sheet_sync', 'catalog.sheet.settings.read', 'catalog.sheet.settings.write', 'catalog.sheet.settings.test', 'catalog.sheet.sync.preview', 'catalog.sheet.sync.apply',
  'catalog.sheet.reconcile.read', 'catalog.sheet.reconcile.write', 'catalog.fulfillment.read', 'catalog.fulfillment.write', 'provider.read', 'provider.sync', 'reconciliation.read', 'reconciliation.resolve',
  'inventory.qr.read', 'inventory.qr.manage', 'inventory.stock.read', 'inventory.stock.manage',
  'orders.read', 'orders.update', 'orders.retry_fulfillment',
  'payments.settings.read', 'payments.settings.write', 'payments.transactions.read',
  'articles.read', 'articles.manage', 'media.upload', 'media.delete',
  'admin.users.read', 'admin.users.manage', 'admin.sessions.revoke',
  'referrals.read', 'referrals.review', 'support.read', 'support.reply', 'support.assign', 'support.status',
  'system.health.read', 'system.config.read_masked', 'system.config.manage', 'admin.dashboard.read', 'admin.access',
];

export const ROLE_PERMISSIONS = {
  content_editor: ['admin.dashboard.read', 'articles.read', 'articles.manage', 'media.upload', 'media.delete'],
  catalog_manager: ['admin.dashboard.read', 'catalog.product.read', 'catalog.product.create', 'catalog.product.update', 'catalog.product.archive', 'catalog.variant.manage', 'catalog.publish', 'catalog.bulk.execute', 'catalog.sheet_sync', 'catalog.sheet.settings.read', 'catalog.sheet.settings.write', 'catalog.sheet.settings.test', 'catalog.sheet.sync.preview', 'catalog.sheet.sync.apply', 'catalog.sheet.reconcile.read', 'catalog.sheet.reconcile.write', 'catalog.fulfillment.read', 'catalog.fulfillment.write'],
  inventory_manager: ['admin.dashboard.read', 'catalog.product.read', 'inventory.qr.read', 'inventory.qr.manage', 'inventory.stock.read', 'inventory.stock.manage'],
  order_operator: ['admin.dashboard.read', 'orders.read', 'orders.update', 'orders.retry_fulfillment', 'payments.transactions.read'],
  technical_admin: ['admin.dashboard.read', 'catalog.product.read', 'catalog.rollback', 'provider.read', 'provider.sync', 'reconciliation.read', 'reconciliation.resolve', 'catalog.fulfillment.read', 'catalog.fulfillment.write', 'system.health.read', 'system.config.read_masked', 'catalog.sheet.settings.read', 'catalog.sheet.settings.test', 'payments.settings.read', 'payments.settings.write', 'payments.transactions.read'],
  super_admin: ['*'],
};

export const permissionsForRoles = (roles = []) => [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []))];
export const hasPermission = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
