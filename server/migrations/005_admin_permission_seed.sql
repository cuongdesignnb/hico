INSERT INTO admin_permissions (name) VALUES
  ('admin.dashboard.read'), ('catalog.product.read'), ('catalog.product.create'), ('catalog.product.update'), ('catalog.product.archive'), ('catalog.variant.manage'), ('catalog.publish'), ('catalog.bulk.execute'), ('catalog.rollback'),
  ('provider.read'), ('provider.sync'), ('reconciliation.read'), ('reconciliation.resolve'), ('inventory.qr.read'), ('inventory.qr.manage'), ('inventory.stock.read'), ('inventory.stock.manage'),
  ('orders.read'), ('orders.update'), ('orders.retry_fulfillment'), ('articles.read'), ('articles.manage'), ('media.upload'), ('media.delete'), ('admin.users.read'), ('admin.users.manage'), ('admin.sessions.revoke'),
  ('system.health.read'), ('system.config.read_masked'), ('system.config.manage'), ('admin.access')
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'content_editor', name FROM admin_permissions WHERE name IN ('admin.dashboard.read','articles.read','articles.manage','media.upload','media.delete')
ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'catalog_manager', name FROM admin_permissions WHERE name IN ('admin.dashboard.read','catalog.product.read','catalog.product.create','catalog.product.update','catalog.product.archive','catalog.variant.manage','catalog.publish','catalog.bulk.execute')
ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'inventory_manager', name FROM admin_permissions WHERE name IN ('admin.dashboard.read','catalog.product.read','inventory.qr.read','inventory.qr.manage','inventory.stock.read','inventory.stock.manage')
ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'order_operator', name FROM admin_permissions WHERE name IN ('admin.dashboard.read','orders.read','orders.update','orders.retry_fulfillment')
ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'technical_admin', name FROM admin_permissions WHERE name IN ('admin.dashboard.read','catalog.product.read','catalog.rollback','provider.read','provider.sync','reconciliation.read','reconciliation.resolve','system.health.read','system.config.read_masked')
ON CONFLICT DO NOTHING;
INSERT INTO admin_role_permissions (role_name, permission_name)
SELECT 'super_admin', name FROM admin_permissions
ON CONFLICT DO NOTHING;
