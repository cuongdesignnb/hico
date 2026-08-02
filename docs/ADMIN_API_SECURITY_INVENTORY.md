# Admin API Security Inventory

All paths below inherit application-level authentication, permission mapping,
and CSRF protection for POST, PUT, PATCH, and DELETE. Reads do not require a
CSRF token. Writes use the admin-write rate-limit group.

| Path family | Read permission | Write permission |
| --- | --- | --- |
| `/api/admin/catalog/products`, variants, audit, versions | `catalog.product.read` | product/variant/archive/rollback specific permission |
| `/api/admin/catalog/bulk/*` | `catalog.product.read` | `catalog.bulk.execute` |
| `/api/admin/catalog/*/publish` | `catalog.product.read` | `catalog.publish` |
| `/api/admin/catalog/reconciliation/*` | `reconciliation.read` | `reconciliation.resolve` |
| `/api/admin/providers/*` | `provider.read` | `provider.sync` |
| `/api/admin/destinations`, `/packages` | `catalog.product.read` | catalog product permission |
| `/api/admin/manual-qrs/*` | `inventory.qr.read` | `inventory.qr.manage` |
| `/api/admin/devices` | `inventory.stock.read` | `inventory.stock.manage` |
| `/api/admin/orders`, `/tickets` | `orders.read` | `orders.update` |
| `/api/admin/articles`, `/reviews` | `articles.read` | `articles.manage` |
| `/api/admin/media/*` | `media.upload` | `media.upload` or `media.delete` |
| `/api/admin/config` | `system.config.read_masked` | `system.config.manage` |
| `/api/admin/users`, `/customers`, `/promos` | `admin.users.read` | `admin.users.manage` |

Unknown future admin routes fail closed behind `admin.access`, which only
`super_admin` receives. Sensitive configuration responses are masked and never
contain credential values.
