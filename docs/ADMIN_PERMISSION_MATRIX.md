# Admin Permission Matrix

| Action | content_editor | catalog_manager | inventory_manager | order_operator | technical_admin | super_admin |
| --- | --- | --- | --- | --- | --- | --- |
| Read and edit articles/media | Yes | No | No | No | No | Yes |
| Read catalog | No | Yes | Yes | No | Yes | Yes |
| Change catalog products, variants, prices | No | Yes | No | No | No | Yes |
| Publish and bulk catalog | No | Yes | No | No | No | Yes |
| Roll back catalog | No | No | No | No | Yes | Yes |
| Manage QR pool and stock | No | No | Yes | No | No | Yes |
| Read/update orders and tickets | No | No | No | Yes | No | Yes |
| Provider sync and reconciliation | No | No | No | No | Yes | Yes |
| Read masked configuration and health | No | No | No | No | Yes | Yes |
| Manage users, sessions, customers, promos | No | No | No | No | No | Yes |

Every `/api/admin/*` request is authenticated, CSRF-protected for writes, and
resolved to a server permission before its route handler executes. UI tab
visibility is only a convenience layer.
