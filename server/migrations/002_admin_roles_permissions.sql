CREATE TABLE IF NOT EXISTS admin_roles (
  name TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  name TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_name TEXT NOT NULL REFERENCES admin_roles(name) ON DELETE CASCADE,
  permission_name TEXT NOT NULL REFERENCES admin_permissions(name) ON DELETE CASCADE,
  PRIMARY KEY (role_name, permission_name)
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL REFERENCES admin_roles(name) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_name)
);

INSERT INTO admin_roles (name) VALUES
  ('content_editor'), ('catalog_manager'), ('inventory_manager'), ('order_operator'), ('technical_admin'), ('super_admin')
ON CONFLICT (name) DO NOTHING;
