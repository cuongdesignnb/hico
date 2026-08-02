export const ALL_PERMISSIONS = [
  'catalog.product.read', 'catalog.product.create', 'catalog.product.update', 'catalog.product.archive', 'catalog.variant.manage', 'catalog.publish', 'catalog.bulk.execute', 'catalog.rollback',
  'provider.read', 'provider.sync', 'reconciliation.read', 'reconciliation.resolve',
  'inventory.qr.read', 'inventory.qr.manage', 'inventory.stock.read', 'inventory.stock.manage',
  'orders.read', 'orders.update', 'orders.retry_fulfillment',
  'articles.read', 'articles.manage', 'media.upload', 'media.delete',
  'admin.users.read', 'admin.users.manage', 'admin.sessions.revoke',
  'referrals.read', 'referrals.review',
  'system.health.read', 'system.config.read_masked', 'system.config.manage', 'admin.dashboard.read', 'admin.access',
];

export const ROLE_PERMISSIONS = {
  content_editor: ['admin.dashboard.read', 'articles.read', 'articles.manage', 'media.upload', 'media.delete'],
  catalog_manager: ['admin.dashboard.read', 'catalog.product.read', 'catalog.product.create', 'catalog.product.update', 'catalog.product.archive', 'catalog.variant.manage', 'catalog.publish', 'catalog.bulk.execute'],
  inventory_manager: ['admin.dashboard.read', 'catalog.product.read', 'inventory.qr.read', 'inventory.qr.manage', 'inventory.stock.read', 'inventory.stock.manage'],
  order_operator: ['admin.dashboard.read', 'orders.read', 'orders.update', 'orders.retry_fulfillment'],
  technical_admin: ['admin.dashboard.read', 'catalog.product.read', 'catalog.rollback', 'provider.read', 'provider.sync', 'reconciliation.read', 'reconciliation.resolve', 'system.health.read', 'system.config.read_masked'],
  super_admin: ['*'],
};

export const permissionsForRoles = (roles = []) => [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []))];
export const hasPermission = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
